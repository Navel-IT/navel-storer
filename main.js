/*
    Copyright (C) 2015-2016 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const _ = require('lodash');
const joi = require('joi');

const db = require('@arangodb').db;
const graphModule = require('@arangodb/general-graph');
const router = require('@arangodb/foxx/router')();

router.post('/batch', function (req, res) {
    var resBody = [];

    var events = {};

    for (const serializedEvent of req.body) {
        try {
            const event = JSON.parse(serializedEvent);

            if (
                event instanceof Array &&
                event.length == 5 &&
                _.isInteger(event[0]) &&
                (_.isNull(event[1]) || _.isString(event[1]) || _.isInteger(event[1])) &&
                (_.isString(event[2]) || _.isInteger(event[2])) &&
                (_.isNull(event[1]) || _.isString(event[1]) || _.isInteger(event[1]))
            ) {
                const documentCollectionName = _.isNull(event[1]) ? 'void' : 'class_' + event[1];

                if ( ! _.has(events, documentCollectionName)) events[documentCollectionName] = [];

                events[documentCollectionName].push(event);
            }
        } catch (e) {
        }
    }

    for (const documentCollectionName of _.keys(events)) {
        try {
            if ( ! db._collection(documentCollectionName)) db._createDocumentCollection(documentCollectionName);

            const documentCollection = db._collection(documentCollectionName);

            documentCollection.ensureSkiplist('time');
            documentCollection.ensureUniqueSkiplist('id');
            documentCollection.ensureFulltextIndex('description');

            for (const event of _.uniqBy(events[documentCollectionName], 'id')) {
                const error = [];

                try {
                    var cursor = documentCollection.byExample({
                        id: event[2]
                    });

                    if (cursor.hasNext()) {
                        documentCollection.update(cursor.next()._id, {
                            time: event[0],
                            description: event[3],
                            data: event[4]
                        });
                    } else {
                        documentCollection.insert({
                            time: event[0],
                            id: event[2],
                            description: event[3],
                            data: event[4]
                        });
                    }
                } catch (e) {
                    errors.push(e);
                }

                resBody.push({
                    class: event[1],
                    id: event[2],
                    errors: errors
                });
            }
        } catch (e) {
        }
    }

    res.json(resBody);
}).body(
    joi.array().required(),
    'List of serialized Navel::Event'
).response(
    joi.array().items(
        joi.object({
            class: joi.alternatives([
                joi.string().allow(null),
                joi.number()
            ]),
            id: joi.alternatives([
                joi.string().allow(null),
                joi.number()
            ]),
            errors: joi.array()
        }).required()
    ).required(),
    'List of Navel::Notification constructor properties'
);

module.context.use(router);

// END
