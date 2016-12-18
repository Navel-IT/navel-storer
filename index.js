/*
    Copyright (C) 2015-2016 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const Joi = require('joi');

const Router = require('@arangodb/foxx/router')();

const eventInTransportFormatSchema = Joi.array().ordered(
    Joi.number().integer().required(),
    Joi.alternatives([
        Joi.string().allow(null),
        Joi.number()
    ]).required(),
    Joi.alternatives([
        Joi.string(),
        Joi.number()
    ]).required(),
    Joi.alternatives([
        Joi.string().allow(null),
        Joi.number()
    ]).required(),
    Joi.any().required()
);

Router.post('/batch', function (req, res) {
    var resBody = [];

    for (var i = 0; i < req.body.length; i++) {
        var errors = [];

        var event;

        try {
            const validate = Joi.validate(JSON.parse(req.body[i]), eventInTransportFormatSchema);

            event = validate.value;

            if (validate.error !== null) throw 'validation error';

            // CRUD with dbs, collections, graphs // event[1] === null in a special collection
        } catch (e) {
            errors.push(e);
        }

        if (event !== undefined) {
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
