/*
    Copyright (C) 2015-2016 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const _ = require('lodash'), joi = require('joi'),
    db = require('@arangodb').db, graphModule = require('@arangodb/general-graph'), router = require('@arangodb/foxx/router')();

router.post('/fill', function (req, res) {
    var notifications = [], errors = [], events = {};

    for (const serializedEvent of req.body) {
        try {
            const event = JSON.parse(serializedEvent);

            if ( ! (
                event instanceof Array &&
                event.length == 5 &&
                _.isInteger(event[0]) &&
                (_.isNull(event[1]) || _.isString(event[1]) || _.isInteger(event[1])) &&
                (_.isString(event[2]) || _.isInteger(event[2])) &&
                (_.isNull(event[1]) || _.isString(event[1]) || _.isInteger(event[1]))
            )) throw new Error('invalid event');

            const documentCollectionName = _.isNull(event[1]) || ! _.isObjectLike(event[4]) ? 'unclassable' : 'class-' + event[1];

            if ( ! _.has(events, documentCollectionName)) events[documentCollectionName] = [];

            events[documentCollectionName].push(event);
        } catch (e) {
            errors.push(e.toString());
        }
    }

    for (const documentCollectionName of _.keys(events)) {
        try {
            if ( ! db._collection(documentCollectionName)) db._createDocumentCollection(documentCollectionName);

            const documentCollection = db._collection(documentCollectionName);

            documentCollection.ensureSkiplist('time');
            documentCollection.ensureSkiplist('id');
            documentCollection.ensureFulltextIndex('description');

            for (const event of events[documentCollectionName]) {
                var errors = [];

                try {
                    const document = documentCollection.insert({
                        time: event[0],
                        id: event[2],
                        description: event[3],
                        data: event[4]
                    });
                } catch (e) {
                    errors.push(e.toString());
                }

                notifications.push({
                    class: event[1],
                    id: event[2],
                    errors: errors
                });
            }
        } catch (e) {
            errors.push(e.toString());
        }
    }

    res.json({
        notifications: notifications,
        errors: errors
    });
}).body(
    joi.array().required(),
    'List of serialized Navel::Event'
).response(
    joi.object({
        notifications: joi.array().items(
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
        errors: joi.array().required()
    }).required(),
    'List of Navel::Notification constructor properties'
);

// router.get('/aggregators', function (req, res) { });
// router.post('/aggregators', function (req, res) { });
// router.get('/aggregators/:aggregator', function (req, res) { });
// router.put('/aggregators/:aggregator', function (req, res) { });
// router.delete('/aggregators/:aggregator', function (req, res) { });

module.context.use(router);

// END
