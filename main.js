// BEGIN

'use strict;'

const _ = require('lodash'),
    joi = require('joi'),
    joi_notification = joi.object({
        notifications: joi.array().items(
            joi.object({
                class: joi.alternatives([
                    joi.string().allow('').allow(null),
                    joi.number()
                ]),
                id: joi.alternatives([
                    joi.string().allow('').allow(null),
                    joi.number()
                ]),
                errors: joi.array().items(
                    joi.string().allow('')
                ).required()
            }).required()
        ).required(),
        errors: joi.array().items(
            joi.string().allow('')
        ).required()
    }).required(),
    joi_aggregator = joi.object({
        name: joi.string().allow('').required(),
        from_class: joi.string().allow('').required(),
        to_class: joi.string().allow('').required(),
        from_path: joi.string().allow('').required(),
        to_path: joi.string().allow('').required()
    }).required(),
    joi_aggregator_optionals = joi_aggregator.optionalKeys(
        _.map(joi_aggregator._inner.children, function (e) {
            return e.key;
        })
    ),
    joi_ok_ko = joi.object({
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

router.post('/fill', function (request, response) {
    var fromEventDocuments = [], notifications = {}, errors = [], aggregators = {};

    for (const serializedEvent of request.body) {
        try {
            const event = JSON.parse(serializedEvent);

            if ( ! (
                event instanceof Array &&
                event.length == 5 &&
                _.isInteger(event[0]) &&
                (_.isNull(event[1]) || _.isString(event[1]) || _.isInteger(event[1])) &&
                (_.isString(event[2]) || _.isInteger(event[2])) &&
                (_.isNull(event[3]) || _.isString(event[3]) || _.isInteger(event[3]))
            )) throw new Error('invalid event');

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
).response(200, joi_notification).response(201, joi_notification);

router.get('/aggregators', function (request, response) {
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
).response(500, joi_ok_ko);

router.post('/aggregators', function (request, response) {
    const ok_ko = {
        ok: [],
        ko: []
    };

    try {
        aggregatorsCollection.insert(request.body);

        ok_ko.ok.push(request.body.name + ': successfuly added.');

        response.status(201);
    } catch (e) {
        ok_ko.ko.push(request.body.name + ': cannot be added: ' + e.toString());

        response.status(e instanceof arango.ArangoError && e.errorNum == arango.ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED ? 409 : 500);
    }

    response.json(ok_ko);
}).body(joi_aggregator).response(201, joi_ok_ko).response(409, joi_ok_ko).response(500, joi_ok_ko);

router.get('/aggregators/:name', function (request, response) {
    const ok_ko = {
        ok: [],
        ko: []
    };

    try {
        const aggregator = aggregatorsCollection.byExample({
            name: request.pathParams.name
        }).toArray();

        if (aggregator.length == 1) {
            return response.json(
                _.omitBy(aggregator[0], function (v, k) {
                    return k.match(/^_/);
                })
            );
        } else {
            response.status(404);

            ok_ko.ko.push(request.pathParams.name + ': not found.');
        }
    } catch (e) {
        response.status(500);

        ok_ko.ko.push(e.toString());
    }

    response.json(ok_ko);
}).pathParam('name', joi.string().allow('').required()).response(200, joi_aggregator).response(404, joi_ok_ko).response(500, joi_ok_ko);

router.put('/aggregators/:name', function (request, response) {
    const ok_ko = {
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
            ok_ko.ko.push(request.pathParams.name + ': successfuly modified.');
        } else {
            ok_ko.ko.push(request.pathParams.name + ': not found.');

            response.status(404);
        }
    } catch (e) {
        ok_ko.ko.push(request.pathParams.name + ': cannot be modified: ' + e.toString());

        response.status(500);
    }

    response.json(ok_ko);
}).pathParam('name', joi.string().allow('').required()).body(joi_aggregator_optionals).response(200, joi_ok_ko).response(404, joi_ok_ko).response(500, joi_ok_ko);

router.delete('/aggregators/:name', function (request, response) {
    const ok_ko = {
        ok: [],
        ko: []
    };

    try {
        if (aggregatorsCollection.removeByExample({
            name: request.pathParams.name
        }) == 1) {
            ok_ko.ok.push(request.pathParams.name + ': successfuly removed.');
        } else {
            ok_ko.ko.push(request.pathParams.name + ': not found.');

            response.status(404);
        }
    } catch (e) {
        ok_ko.ko.push(request.pathParams.name + ': cannot be removed: ' + e.toString());

        response.status(500);
    }

    response.json(ok_ko);
}).pathParam('name', joi.string().allow('').required()).response(200, joi_ok_ko).response(404, joi_ok_ko).response(500, joi_ok_ko);

module.context.use(router);

// END
