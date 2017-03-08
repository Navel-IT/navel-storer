/*
    Copyright (C) 2015-2017 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const _ = require('lodash'),
    joi = require('joi'),
    joiRawEvent = joi.array().items(
        joi.number().integer().required(),
        joi.alternatives([
            joi.string().allow('').allow(null),
            joi.number().integer()
        ]).required(),
        joi.alternatives([
            joi.string().allow(''),
            joi.number().integer()
        ]).required(),
        joi.alternatives([
            joi.string().allow('').allow(null),
            joi.number().integer()
        ]).required(),
        joi.any()
    ).required(),
    joiNotification = joi.object({
        notifications: joi.array().items(
            joi.object({
                class: joi.alternatives([
                    joi.string().allow('').allow(null),
                    joi.number()
                ]).required(),
                id: joi.alternatives([
                    joi.string().allow('').allow(null),
                    joi.number()
                ]).required(),
                errors: joi.array().items(
                    joi.string().allow('')
                ).required()
            }).required()
        ).required(),
        errors: joi.array().items(
            joi.string().allow('')
        ).required()
    }).required(),
    joiAggregator = joi.object({
        name: joi.string().allow('').required(),
        from_class: joi.string().allow('').required(),
        to_class: joi.string().allow('').required(),
        from_path: joi.string().allow('').required(),
        to_path: joi.string().allow('').required()
    }).required(),
    joiOkKo = joi.object({
        ok: joi.array(
            joi.string().allow('')
        ).required(),
        ko: joi.array(
            joi.string().allow('')
        ).required()
    }).required(),
    arango = require('@arangodb'),
    router = require('@arangodb/foxx/router')(),
    eventsCollection = arango.db._collection('events'),
    relationsCollection = arango.db._collection('relations'),
    aggregatorsCollection = arango.db._collection('aggregators');

router.post('/fill', (request, response) => {
    var fromEventDocuments = [], notifications = {}, errors = [], aggregators = {};

    for (const serializedEvent of request.body) {
        try {
            const event = JSON.parse(serializedEvent);

            if ( ! joiRawEvent.validate(event)) throw new Error('invalid event');

            const fromEventDocument = eventsCollection.insert({
                time: event[0],
                class: event[1],
                id: event[2],
                description: event[3],
                data: event[4]
            }, {
                returnNew: true
            }).new

            fromEventDocuments.push(fromEventDocument);

            notifications[fromEventDocument._id] = {
                class: fromEventDocument.class,
                id: fromEventDocument.id,
                errors: []
            };
        } catch (e) {
            errors.push(e.toString());
        }
    }

    if (fromEventDocuments.length) response.status(201);

    for (const fromEventDocument of _.sortBy(fromEventDocuments, 'time')) {
        try {
            if ( ! _.isNull(fromEventDocument.class) && _.isObjectLike(fromEventDocument.data)) {
                if ( ! aggregators[fromEventDocument.class]) aggregators[fromEventDocument.class] = aggregatorsCollection.byExample({
                    from_class: fromEventDocument.class
                }).toArray();

                for (const aggregator of aggregators[fromEventDocument.class]) {
                    arango.db._query(`
FOR eventDocument IN @@eventsCollection
    FILTER eventDocument.class == @toClass
    COLLECT id = eventDocument.id AGGREGATE time = MAX(eventDocument.time)
    FOR eventDocument IN @@eventsCollection
        FILTER eventDocument.id == id && eventDocument.time == time && eventDocument.@toPathToArray == @fromValue
            INSERT {
                _from: @fromEventDocumentId,
                _to: eventDocument._id,
                from_path: @fromPath,
                to_path: @toPath
            } IN @@relationsCollection
`,
                    {
                        '@eventsCollection': eventsCollection.name(),
                        '@relationsCollection': relationsCollection.name(),
                        toClass: aggregator.to_class,
                        toPath: aggregator.to_path,
                        toPathToArray: _.toPath(aggregator.to_path),
                        fromPath: aggregator.from_path,
                        fromValue: _.get(fromEventDocument, aggregator.from_path),
                        fromEventDocumentId: fromEventDocument._id
                    });
                }
            }
        } catch (e) {
            notifications[fromEventDocument._id].errors.push(e.toString());
        }
    }

    response.json({
        notifications: _.values(notifications),
        errors: errors
    });
}).body(
    joi.array(
        joi.string().allow('')
    ).required()
).response(200, joiNotification).response(201, joiNotification);

router.get('/aggregators', (request, response) => {
    try {
        response.json(arango.db._query('FOR aggregator IN @@aggregatorsCollection RETURN aggregator.name', {
            '@aggregatorsCollection': aggregatorsCollection.name()
        }).toArray());
    } catch (e) {
        response.status(500).json({
            ok: [],
            ko: [
                e.toString()
            ]
        });
    }
}).response(
    200,
    joi.array().items(
        joi.string().allow('')
    ).required()
).response(500, joiOkKo);

router.post('/aggregators', (request, response) => {
    const okKo = {
        ok: [],
        ko: []
    };

    try {
        aggregatorsCollection.insert(request.body);

        okKo.ok.push(request.body.name + ': successfuly added.');

        response.status(201);
    } catch (e) {
        okKo.ko.push(request.body.name + ': cannot be added: ' + e.toString());

        response.status(e instanceof arango.ArangoError && e.errorNum == arango.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED ? 409 : 500);
    }

    response.json(okKo);
}).body(joiAggregator).response(201, joiOkKo).response(409, joiOkKo).response(500, joiOkKo);

router.get('/aggregators/:name', (request, response) => {
    const okKo = {
        ok: [],
        ko: []
    };

    try {
        const aggregator = aggregatorsCollection.byExample({
            name: request.pathParams.name
        }).toArray();

        if (aggregator.length == 1) {
            return response.json(
                _.omitBy(aggregator[0], (v, k) => k.match(/^_/))
            );
        } else {
            response.status(404);

            okKo.ko.push(request.pathParams.name + ': not found.');
        }
    } catch (e) {
        response.status(500);

        okKo.ko.push(e.toString());
    }

    response.json(okKo);
}).pathParam('name', joi.string().allow('').required()).response(200, joiAggregator).response(404, joiOkKo).response(500, joiOkKo);

router.put('/aggregators/:name', (request, response) => {
    const okKo = {
        ok: [],
        ko: []
    };

    try {
        if (aggregatorsCollection.updateByExample(
            {
                name: request.pathParams.name
            },
            _.omit(request.body, 'name'),
            {
                mergeObject: true
            }
        ) == 1) {
            okKo.ko.push(request.pathParams.name + ': successfuly modified.');
        } else {
            okKo.ko.push(request.pathParams.name + ': not found.');

            response.status(404);
        }
    } catch (e) {
        okKo.ko.push(request.pathParams.name + ': cannot be modified: ' + e.toString());

        response.status(500);
    }

    response.json(okKo);
}).pathParam('name', joi.string().allow('').required()).body(
    joiAggregator.optionalKeys(
        _.map(joiAggregator._inner.children, e => e.key)
    )
).response(200, joiOkKo).response(404, joiOkKo).response(500, joiOkKo);

router.delete('/aggregators/:name', (request, response) => {
    const okKo = {
        ok: [],
        ko: []
    };

    try {
        if (aggregatorsCollection.removeByExample({
            name: request.pathParams.name
        }) == 1) {
            okKo.ok.push(request.pathParams.name + ': successfuly removed.');
        } else {
            okKo.ko.push(request.pathParams.name + ': not found.');

            response.status(404);
        }
    } catch (e) {
        okKo.ko.push(request.pathParams.name + ': cannot be removed: ' + e.toString());

        response.status(500);
    }

    response.json(okKo);
}).pathParam('name', joi.string().allow('').required()).response(200, joiOkKo).response(404, joiOkKo).response(500, joiOkKo);

module.context.use(router);

// END
