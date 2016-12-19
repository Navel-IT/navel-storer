/*
    Copyright (C) 2015-2016 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const _ = require('lodash');
const Joi = require('joi');

const Router = require('@arangodb/foxx/router')();

Router.post('/batch', function (req, res) {
    var resBody = [];

    for (var i = 0; i < req.body.length; i++) {
        var errors = [];

        var event;

        try {
            event = JSON.parse(req.body[i]);

            if ( ! (
                event instanceof Array &&
                event.length == 5 &&
                _.isInteger(event[0]) &&
                (_.isNull(event[1]) || _.isString(event[1]) || _.isInteger(event[1])) &&
                (_.isString(event[2]) || _.isInteger(event[2])) &&
                (_.isNull(event[1]) || _.isString(event[1]) || _.isInteger(event[1]))
            )) {
                event = undefined;

                throw 'invalid event';
            }

            // CRUD with dbs, collections, graphs // event[1] === null in a special collection
        } catch (e) {
            errors.push(e);
        }

        if ( ! _.isUndefined(event)) {
            resBody.push({
                class: event[1],
                id: event[2],
                errors: errors
            });
        }
    }

    res.json(resBody);
}).body(
    Joi.array().required(),
    'List of serialized Navel::Event'
).response(
    Joi.array().items(
        Joi.object({
            class: Joi.alternatives([
                Joi.string().allow(null),
                Joi.number()
            ]),
            id: Joi.alternatives([
                Joi.string().allow(null),
                Joi.number()
            ]),
            errors: Joi.array()
        }).required()
    ).required(),
    'List of Navel::Notification constructor properties'
);

module.context.use(Router);

// END
