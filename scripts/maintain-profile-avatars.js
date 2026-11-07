#!/usr/bin/env node
'use strict';
require('../lib/profile-avatars').cleanup().then(result=>console.log('Profile picture cleanup:',JSON.stringify(result))).catch(error=>{console.error('Profile picture cleanup failed:',error.code||error.message);process.exitCode=1;});
