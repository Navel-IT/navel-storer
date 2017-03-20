/*
    Copyright (C) 2015-2017 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const
    _ = require('lodash'),
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
    joiFillEndpointResponse = joi.object({
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
        from_class: joi.string().required(),
        to_class: joi.string().required(),
        from_path: joi.string().required(),
        to_path: joi.string().required()
    }).required(),
    joiOkKo = joi.object({
        ok: joi.array().items(
            joi.string().allow('')
        ).required(),
        ko: joi.array().items(
            joi.string().allow('')
        ).required()
    }).required(),
    arango = require('@arangodb'),
    router = require('@arangodb/foxx/router')(),
    oCollection = module.context.collection('o'),
    dCollection = module.context.collection('d'),
    ooCollection = module.context.collection('oo'),
    odCollection = module.context.collection('od'),
    aCollection = module.context.collection('a');

router.use('/docs', module.context.createDocumentationRouter());

router.post('/fill', (request, response) => {
    const
        notifications = {},
        errors = [],
        oDocuments = [];

    for (const serializedRawEvent of request.body) {
        try {
            const joiRawEventValidation = joi.validate(JSON.parse(serializedRawEvent), joiRawEvent);

            if ( ! _.isNull(joiRawEventValidation.error)) throw new Error('invalid event: ' + joiRawEventValidation.error.message);

            const object = {
                class: joiRawEventValidation.value[1],
                id: joiRawEventValidation.value[2],
                description: joiRawEventValidation.value[3]
            };

            const oDocument = arango.db._query(`
LET oDocument = (
    UPSERT {
        id: @object.id
    } INSERT @object UPDATE @object INTO @@oCollectionName

    RETURN NEW
)[0]

INSERT {
    _from: oDocument._id,
    _to: (
        INSERT @data INTO @@dCollectionName

        RETURN NEW._id
    )[0],
    time: @time
} INTO @@odCollectionName

RETURN oDocument
`,
            {
                '@oCollectionName': oCollection.name(),
                '@dCollectionName': dCollection.name(),
                '@odCollectionName': odCollection.name(),
                object: object,
                data: joiRawEventValidation.value[4],
                time: joiRawEventValidation.value[0],
            }).toArray()[0];

            oDocuments.push(oDocument);

            notifications[oDocument._id] = {
                class: object.class,
                id: object.id,
                errors: []
            };
        } catch (e) {
            errors.push(e.toString());
        }
    }

    if (oDocuments.length) {
        response.status(201);

        for (const aggregator of aCollection.all().toArray()) {
            for (const oDocument of oDocuments) {
                if (oDocument.class == aggregator.from_class) {
                    try {
                        arango.db._query(`
LET fromData = (
    FOR v, e IN OUTBOUND @oDucumentId
        @@odCollectionName
        LIMIT 1
        SORT e.time DESC
        RETURN v
)[0]

FOR object IN @@oCollectionName
    LET toData = (
        FOR v, e IN OUTBOUND object._id
            @@odCollectionName
            LIMIT 1
            SORT e.time DESC
            RETURN v
    )[0]

    FILTER fromData.@fromPathToArray == toData.@toPathToArray
    INSERT {
        _from: @oDucumentId,
        _to: object._id,
        creation_time: DATE_NOW() / 1000,
        from_path: @fromPath,
        to_path: @toPath
    } IN @@ooCollectionName
`,
                        {
                            '@odCollectionName': odCollection.name(),
                            '@oCollectionName': oCollection.name(),
                            '@ooCollectionName': ooCollection.name(),
                            'oDucumentId': oDocument._id,
                            'fromPath': aggregator.from_path,
                            'toPath': aggregator.to_path,
                            'fromPathToArray': _.toPath(aggregator.from_path),
                            'toPathToArray': _.toPath(aggregator.to_path)
                        });
                    } catch (e) {
                        notifications[oDocument._id].errors.push(e.toString());
                    }
                }
            }
        }
    }

    response.json({
        notifications: _.values(notifications),
        errors: errors
    });
}).body(
    joi.array().items(
        joi.string().allow('')
    ).required()
).response(200, joiFillEndpointResponse).response(201, joiFillEndpointResponse);

router.get('/aggregators', (request, response) => {
    try {
        response.json(arango.db._query('FOR aggregator IN @@aCollectionName RETURN aggregator.name', {
            '@aCollectionName': aCollection.name()
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
        aCollection.insert(request.body);

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
        const aggregator = aCollection.byExample({
            name: request.pathParams.name
        }).next();

        if (aggregator) {
            return response.json(
                _.omitBy(aggregator, (v, k) => k.match(/^_/))
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
        if (aCollection.updateByExample(
            {
                name: request.pathParams.name
            },
            _.omit(request.body, 'name'),
            {
                mergeObject: true,
                limit: 1
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
        if (aCollection.removeByExample({
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
