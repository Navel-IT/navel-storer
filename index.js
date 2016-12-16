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
    [
        Joi.string().allow(null).required(),
        Joi.number().required()
    ],
    [
        Joi.string().required(),
        Joi.number().required()
    ],
    [
        Joi.string().allow(null).required(),
        Joi.number().required()
    ],
    Joi.any().required()
);

Router.post('/batch', function (req, res) {
    var resBody = [];

    for (var i = 0; i < req.body.length; i++) {
        var errors = [];

        try {
            const event = JSON.parse(req.body);

            const validate = Joi.validate(event, eventInTransportFormatSchema);

            if (validate.error !== null) throw validate.error;

            // CRUD with dbs, collections, graphs // event[1] === null in a special collection
        } catch (e) {
            errors.push(e);
        }

        resBody.push({
            class: event.class,
            id: event.id,
            errors: errors
        });
    }

    res.json(resBody);
}).body(
    Joi.array().required(),
    'List of serialized Navel::Event'
).response(
    Joi.array().items(
        Joi.object({
            class: [
                Joi.string().allow(null).required(),
                Joi.number().required()
            ],
            id: [
                Joi.string().required(),
                Joi.number().required()
            ],
            errors: Joi.array()
        }).required()
    ).required(),
    'List of Navel::Notification constructor properties'
);

module.context.use(Router);

// END
