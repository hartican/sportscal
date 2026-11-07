#!/usr/bin/env node
'use strict';
const result=require('./lib/reconcile-fixture-results').reconcileFiles();
console.log(`Reconciled ${result.changed.length} existing Feed result(s) from retained official fixture evidence.`);
