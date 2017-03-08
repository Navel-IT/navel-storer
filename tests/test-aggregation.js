/*
    Copyright (C) 2015-2017 Yoann Le Garff, Nicolas Boquet and Yann Le Bras
    navel-storer is licensed under the Apache License, Version 2.0
*/

// BEGIN

'use strict';

const _ = require('lodash'),
    chai = require('chai'),
    chaiHttp = require('chai-http'),
    aggegation = {
        name: _.random(99999.0, 999999999).toString(),
        from_class: 'son',
        from_path: 'data.father_id',
        to_class: 'father',
        to_path: 'data.id'
    };

chai.use(chaiHttp);

// TODO

// END
