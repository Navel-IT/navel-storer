/*
    Copyright (C) 2015-2016 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict;'

const Joi = require('joi');

const Router = require('@arangodb/foxx/router')();

eventInTransportFormatSchema = Joi.array().ordered(
    Joi.integer().required(),
    [
        Joi.string().required(),
        Joi.number().required()
    ],
    [
        Joi.string().required(),
        Joi.number().required()
    ],
    [
        Joi.string(),
        Joi.number()
    ],
    Joi.any().required(),
);

Router.post('/batch', function (req, res) {
    var resBody = [];

    for (var i = 0; i < req.body.length; i++) {
        var errors = [];

        try {
            var event = JSON.parse(req.body);

            var error = Joi.validate(event, eventInTransportFormatSchema);

            if (error) throw error;

            // CRUD with dbs, collections, graphs
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
                Joi.string().required(),
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
