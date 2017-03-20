'use strict';
const uuidV4 = require('uuid/v4');

module.exports = function (app, config, helper) {

    return {
        IndexPidList(req, res, next){
            let cachedMap = helper.getCachedSocket();
            let pidList = Object.keys(cachedMap);
            let {projectList, projectPidMap} = pidList.reduce((pre, next) => {
                let newProjectName = next.split('::')[0];
                let newProjectPid = next.split('::')[1];
                if (!~pre.projectList.indexOf(newProjectName)) {
                    pre.projectList.push(newProjectName);
                }
                if (pre.projectPidMap[newProjectName]) {
                    pre.projectPidMap[newProjectName].push(newProjectPid);
                } else {
                    pre.projectPidMap[newProjectName] = [newProjectPid];
                }
                return pre;
            }, {projectList: [], projectPidMap: {}});

            res.render('NewIndex', {projectList, projectPidMap});
        },

        CPUProfiler(req, res, next){
            const uuid = uuidV4();
            let processId = req.params.ProcessID;
            let socket = helper.getCachedSocket()[processId];
            if (socket) {
                socket.write(JSON.stringify({
                        type: config.MESSAGE_TYPE[2],
                        data: JSON.stringify({
                            timeout: req.query.timeout || 500,
                            uuid
                        })
                    }) + '\n\n');

                helper.event.once(uuid, statistics => {
                    res.render('CPUProfiler', {
                        processName: processId.split('::')[0],
                        processPid: processId.split('::')[1],
                        timeout: req.query.timeout || 500,
                        data: statistics
                    });
                });
            } else {
                res.redirect('/');
            }
        },

        CPUProfilerProject(req, res, next){
            function getProcessProfilerP(item) {
                let socket = item.socket;
                let name = item.name;
                return new Promise((resolve, reject) => {
                    const uuid = uuidV4();
                    socket.write(JSON.stringify({
                            type: config.MESSAGE_TYPE[2],
                            data: JSON.stringify({
                                timeout: req.query.timeout || 500,
                                uuid
                            })
                        }) + '\n\n');

                    helper.event.once(uuid, statistics => {
                        resolve({
                            processName: name.split('::')[0],
                            processPid: name.split('::')[1],
                            timeout: req.query.timeout || 500,
                            data: statistics
                        })
                    });
                });
            }


            let projectName = req.params.ProjectName;
            let socketPackage = helper.getCachedSocket();
            let socketList = Object.keys(socketPackage).reduce((pre, next) => {
                if (next.split('::')[0] === projectName) {
                    pre.push({name: next, socket: socketPackage[next]});
                }
                return pre;
            }, []);

            if (socketList.length === 0) {
                res.redirect('/');
            } else {
                let promiseList = socketList.map(item => getProcessProfilerP(item));
                Promise.all(promiseList).then(result => {
                    res.render('CPUProfilerProject', {
                        projectName,
                        data: result
                    })
                });
            }
        }
    }
};