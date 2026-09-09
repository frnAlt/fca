/* eslint-disable no-self-assign */
/* eslint-disable linebreak-style */
const get = require('lodash/get');
const set = require('lodash/set');
let BetterDB = null;
try {
    BetterDB = require("better-sqlite3");
} catch (_) {
    BetterDB = null;
}
const fs = require('fs');
let deasync = null;
try {
    deasync = require('deasync');
} catch (_) {
    deasync = { loopWhile: function(fn) { /* fallback */ } };
}

if (!fs.existsSync(process.cwd() + '/Horizon_Database')) {
    try {
        fs.mkdirSync(process.cwd() + '/Horizon_Database', { recursive: true });
        fs.writeFileSync(process.cwd() + '/Horizon_Database/A_README.md', 'This folder is used by ChernobyL(NANI =)) ) to store data. Do not delete this folder or any of the files in it.', 'utf8');
    } catch (_) {}
}

let db = null;
let memoryStore = {};
const jsonDbPath = process.cwd() + "/Horizon_Database/SyntheticDatabase.json";

if (BetterDB) {
    try {
        db = new BetterDB(process.cwd() + "/Horizon_Database/SyntheticDatabase.sqlite");
    } catch (_) {
        db = null;
    }
}

if (!db) {
    try {
        if (fs.existsSync(jsonDbPath)) {
            memoryStore = JSON.parse(fs.readFileSync(jsonDbPath, "utf8") || "{}");
        }
    } catch (_) {
        memoryStore = {};
    }
}

function saveMemoryStore() {
    try {
        fs.writeFileSync(jsonDbPath, JSON.stringify(memoryStore, null, 2), "utf8");
    } catch (_) {}
}

function Lset(key, value) {
    if (!key)
        throw new TypeError(
            "No key specified."
        );
    return arbitrate("set",{
        stringify: false,
        id: key,
        data: value,
        ops:  {},
    });
}

function Lget(key) {
    if (!key)
        throw new TypeError(
            "No key specified."
        );
    return arbitrate("fetch", { id: key, ops: {} || {} });
}

function Lhas(key) {
    if (!key)
        throw new TypeError(
            "No key specified."
        );
    return arbitrate("has", { id: key, ops: {} });
}

function Lremove(key) {
    if (!key)
        throw new TypeError(
            "No key specified."
        );
    return arbitrate("delete", { id: key, ops: {} });
}

function LremoveMultiple(key) {
    if (!key)
        throw new TypeError(
            "No key specified."
        );
        try {
            for (let i of key) {
                arbitrate("delete", { id: i, ops: {} });
            }
            return true;
        } 
    catch (err) {
        return false;
    }
}

function Llist() {
    return arbitrate("all",{ ops: {} });
}

function Replit_Set(key, value) {
    try {
        var done = false;
        
        request({
            url: process.env.REPLIT_DB_URL,
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },  
            body: `${encodeURIComponent(key)}=${encodeURIComponent(JSON.stringify(value))}`
        
        }, function (error, response, body) {
            done = true;
        });

        deasync.loopWhile(function(){
            return !done;
        });

        return;
        
    }
    catch (e) {
        console.log(e);
        return false;
    }
}

function Replit_Get(key) {
    try {
        var done = false;
        var response = null;
    
        request(process.env.REPLIT_DB_URL + "/" + key, function (error, res, body) {
            if (!error && res.statusCode == 200) {
                response = body;
            }
            done = true;
        });
    
        deasync.loopWhile(function(){
            return !done;
        });
    
        return JSON.parse(response);
    }
    catch (e) {
        console.log(e);
        return false;
    }
}

function Replit_Has(key) {
    try {
        var done = false;
        var response = null;

        request(process.env.REPLIT_DB_URL + "/" + key, function (error, res, body) {
            if (!error && res.statusCode == 200) {
                response = body;
            }
            done = true;
        });

        deasync.loopWhile(function(){
            return !done;
        });

        return response != null;
    }
    catch (e) {
        console.log(e);
        return false;
    }
}

function Replit_Remove(key) {
    try {
        var done = false;
        request.delete(process.env.REPLIT_DB_URL + "/" + key , function (error, response, body) {
            done = true;
        });

        deasync.loopWhile(function(){
            return !done;
        });

        return;
    }
    catch (e) {
        console.log(e);
        return false;
    }
}
function Replit_RemoveMultiple(keys) {
    try {
        for (const key of keys) {
            request.delete(process.env.REPLIT_DB_URL + "/" + key , function (error, response, body) {});
        }
        return true;
    }
    catch (e) {
        console.log(e);
        return false;
    }
}

function Replit_List() {
    var done = false;
    var response = null;

    request(process.env.REPLIT_DB_URL + "?encode=true" + `&prefix=${encodeURIComponent("")}`, function (error, res, body) {
        if (!error && res.statusCode == 200) {
            response = body;
        }
        done = true;

    });

    deasync.loopWhile(function(){
        return !done;
    });

    if (response.length === 0) {
        return [];
    }
    return response.split("\n").map(decodeURIComponent);
}


var methods = {
    fetch: function(db, params, options) {
        let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) return null;
        try { 
            fetched = JSON.parse(fetched.json);
        } catch (e) {
            fetched = fetched.json;
        }
        return fetched;
    },
    set: function(db, params, options) {
        let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) {
            db.prepare(`INSERT INTO ${options.table} (ID,json) VALUES (?,?)`).run(params.id, '{}');
            fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        }
        try { 
            fetched = JSON.parse(fetched); 
        } catch (e) {
            fetched = fetched;
        }
        if (typeof fetched === 'object' && params.ops.target) {
            params.data = JSON.parse(params.data);
            params.data = set(fetched, params.ops.target, params.data);
        } 
        else if (params.ops.target) throw new TypeError('Cannot target a non-object.');
        db.prepare(`UPDATE ${options.table} SET json = (?) WHERE ID = (?)`).run(JSON.stringify(params.data), params.id);
        let newData = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id).json;
        if (newData === '{}') return null;
        else {
            try { newData = JSON.parse(newData); 
            } 
            catch (e) {
                newData = newData;
            }
            return newData;
        }
    },
    add: function addDB(db, params, options) {
        let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) {
            db.prepare(`INSERT INTO ${options.table} (ID,json) VALUES (?,?)`).run(params.id, '{}');
            fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id); 
        }
        if (params.ops.target) {
            try { 
                fetched = JSON.parse(fetched); 
            }
            catch (e) {
                fetched = fetched;
            }
            let oldValue = get(fetched, params.ops.target);
            if (oldValue === undefined) oldValue = 0;
            else if (isNaN(oldValue)) throw new Error(`Data @ ID: "${params.id}" IS NOT A number.\nFOUND: ${fetched}\nEXPECTED: number`);
            params.data = set(fetched, params.ops.target, oldValue + JSON.parse(params.data));
        } 
        else {
            if (fetched.json === '{}') fetched.json = 0;
            try { 
                fetched.json = JSON.parse(fetched); 
            } catch (e) {
                fetched.json = fetched.json;
            }
            if (isNaN(fetched.json)) throw new Error(`Data @ ID: "${params.id}" IS NOT A number.\nFOUND: ${fetched.json}\nEXPECTED: number`);
            params.data = parseInt(fetched.json, 10) + parseInt(params.data, 10);
        }
        db.prepare(`UPDATE ${options.table} SET json = (?) WHERE ID = (?)`).run(JSON.stringify(params.data), params.id);
        let newData = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id).json;
        if (newData === '{}') return null;
        else {
            try {  
                newData = JSON.parse(newData); 
            } 
            catch (e) {
                newData = newData;
            }
            return newData;
        }
    },
    subtract: function subtractDB(db, params, options) {
       let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) {
            db.prepare(`INSERT INTO ${options.table} (ID,json) VALUES (?,?)`).run(params.id, '{}');
            fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id); 
        }
        if (params.ops.target) {
            try { fetched = JSON.parse(fetched); } catch (e) {}
            params.data = JSON.parse(params.data);
            let oldValue = get(fetched, params.ops.target);
            if (oldValue === undefined) oldValue = 0;
            else if (isNaN(oldValue)) throw new Error('Target is not a number.');
            params.data = set(fetched, params.ops.target, oldValue - params.data);
        } else {
            if (fetched.json === '{}') fetched.json = 0;
            else fetched.json = JSON.parse(fetched.json);
            try { fetched.json = JSON.parse(fetched); } catch (e) {}
            if (isNaN(fetched.json)) throw new Error('Target is not a number.');
            params.data = parseInt(fetched.json, 10) - parseInt(params.data, 10);
        }
        params.data = JSON.stringify(params.data);
        db.prepare(`UPDATE ${options.table} SET json = (?) WHERE ID = (?)`).run(params.data, params.id);
        let newData = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id).json;
        if (newData === '{}') return null;
        else {
            try { newData = JSON.parse(newData); } catch (e) {}
            return newData;
        }
    },
    push: function pushDB(db, params, options) {
        let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) {
            db.prepare(`INSERT INTO ${options.table} (ID,json) VALUES (?,?)`).run(params.id, '{}');
            fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id); 
        }
        if (params.ops.target) {
            fetched = JSON.parse(fetched.json);
        try { fetched = JSON.parse(fetched); } catch (e) {}
            params.data = JSON.parse(params.data);
        if (typeof fetched !== 'object') throw new TypeError('Cannot push into a non-object.');
        let oldArray = get(fetched, params.ops.target);
        if (oldArray === undefined) oldArray = [];
        else if (!Array.isArray(oldArray)) throw new TypeError('Target is not an array.');
            oldArray.push(params.data);
            params.data = set(fetched, params.ops.target, oldArray);
        } else {
        if (fetched.json === '{}') fetched.json = [];
        else fetched.json = JSON.parse(fetched.json);
        try { fetched.json = JSON.parse(fetched.json); } catch (e) {}
            params.data = JSON.parse(params.data);
        if (!Array.isArray(fetched.json)) throw new TypeError('Target is not an array.');
            fetched.json.push(params.data);
            params.data = fetched.json;
        }
        params.data = JSON.stringify(params.data);
        db.prepare(`UPDATE ${options.table} SET json = (?) WHERE ID = (?)`).run(params.data, params.id);
        let newData = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id).json;
        if (newData === '{}') return null;
        else {
            newData = JSON.parse(newData);
        try { newData = JSON.parse(newData); } catch (e) {}
        return newData;
        }
    },
    delete: function deleteDB(db, params, options) {
        const unset = require('lodash/unset');
        let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) return false;
        else fetched = JSON.parse(fetched.json);
        try { fetched = JSON.parse(fetched); } catch (e) {}
        if (typeof fetched === 'object' && params.ops.target) {
            unset(fetched, params.ops.target);
            fetched = JSON.stringify(fetched);
            db.prepare(`UPDATE ${options.table} SET json = (?) WHERE ID = (?)`).run(fetched, params.id);
        return true;
        }
        else if (params.ops.target) throw new TypeError('Target is not an object.');
        else db.prepare(`DELETE FROM ${options.table} WHERE ID = (?)`).run(params.id);
        return true;
    },
    has: function hasDB(db, params, options) {
        let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) return false;
        else fetched = JSON.parse(fetched.json);
        try { fetched = JSON.parse(fetched); } catch (e) {}
        if (params.ops.target) fetched = get(fetched, params.ops.target);
        return (typeof fetched != 'undefined');
    },
    all: function allDB(db, params, options) {
        var stmt = db.prepare(`SELECT * FROM ${options.table} WHERE ID IS NOT NULL`);
        let resp = [];
        for (var row of stmt.iterate()) {
            try {
            resp.push({
                ID: row.ID,
                data: JSON.parse(row.json)
            });
            } 
            catch (e) {
                return [];
            }
        }
        return resp;
    },
    type: function typeDB(db, params, options) {
        let fetched = db.prepare(`SELECT * FROM ${options.table} WHERE ID = (?)`).get(params.id);
        if (!fetched) return null; // If empty, return null
        fetched = JSON.parse(fetched.json);
        try { fetched = JSON.parse(fetched); } catch (e) {}
        if (params.ops.target) fetched = get(fetched, params.ops.target); // Get prop using dot notation
        return typeof fetched;
    },
    clear: function clearDB(db, params, options) {
        let fetched = db.prepare(`DELETE FROM ${options.table}`).run();
        if(!fetched) return null;
        return fetched.changes;
        
    }
};


function arbitrate(method, params) {
    if (params.ops && params.ops.target && params.ops.target[0] === ".") params.ops.target = params.ops.target.slice(1);
    if (params.data && params.data === Infinity) throw new TypeError(`You cannot set Infinity into the database @ ID: ${params.id}`);
    if (params.id && typeof params.id == "string" && params.id.includes(".")) {
        let unparsed = params.id.split(".");
        params.id = unparsed.shift();
        if (!params.ops) params.ops = {};
        params.ops.target = unparsed.join(".");
    }

    if (db) {
        let options = {table: "json"};
        db.prepare(`CREATE TABLE IF NOT EXISTS ${options.table} (ID TEXT, json TEXT)`).run();
        return methods[method](db, params, options);
    }

    switch (method) {
        case "set": {
            if (params.ops && params.ops.target) {
                let current = memoryStore[params.id] || {};
                set(current, params.ops.target, params.data);
                memoryStore[params.id] = current;
            } else {
                memoryStore[params.id] = params.data;
            }
            saveMemoryStore();
            return memoryStore[params.id];
        }
        case "fetch": {
            const val = memoryStore[params.id];
            if (val === undefined) return null;
            if (params.ops && params.ops.target) return get(val, params.ops.target);
            return val;
        }
        case "has": {
            if (params.ops && params.ops.target) {
                return get(memoryStore[params.id], params.ops.target) !== undefined;
            }
            return memoryStore[params.id] !== undefined;
        }
        case "delete": {
            if (params.ops && params.ops.target && memoryStore[params.id]) {
                delete memoryStore[params.id][params.ops.target];
            } else {
                delete memoryStore[params.id];
            }
            saveMemoryStore();
            return true;
        }
        case "all": {
            return Object.keys(memoryStore).map(id => ({ ID: id, data: memoryStore[id] }));
        }
        case "add": {
            let cur = memoryStore[params.id];
            if (params.ops && params.ops.target) {
                cur = cur || {};
                let old = get(cur, params.ops.target) || 0;
                let updated = old + (typeof params.data === "number" ? params.data : JSON.parse(params.data));
                set(cur, params.ops.target, updated);
                memoryStore[params.id] = cur;
            } else {
                let old = (typeof cur === "number") ? cur : 0;
                memoryStore[params.id] = old + (typeof params.data === "number" ? params.data : parseInt(params.data, 10));
            }
            saveMemoryStore();
            return memoryStore[params.id];
        }
        case "subtract": {
            let cur = memoryStore[params.id];
            if (params.ops && params.ops.target) {
                cur = cur || {};
                let old = get(cur, params.ops.target) || 0;
                let updated = old - (typeof params.data === "number" ? params.data : JSON.parse(params.data));
                set(cur, params.ops.target, updated);
                memoryStore[params.id] = cur;
            } else {
                let old = (typeof cur === "number") ? cur : 0;
                memoryStore[params.id] = old - (typeof params.data === "number" ? params.data : parseInt(params.data, 10));
            }
            saveMemoryStore();
            return memoryStore[params.id];
        }
        case "push": {
            let cur = memoryStore[params.id];
            if (params.ops && params.ops.target) {
                cur = cur || {};
                let arr = get(cur, params.ops.target) || [];
                if (!Array.isArray(arr)) arr = [arr];
                arr.push(params.data);
                set(cur, params.ops.target, arr);
                memoryStore[params.id] = cur;
            } else {
                let arr = Array.isArray(cur) ? cur : (cur ? [cur] : []);
                arr.push(params.data);
                memoryStore[params.id] = arr;
            }
            saveMemoryStore();
            return memoryStore[params.id];
        }
        case "clear": {
            memoryStore = {};
            saveMemoryStore();
            return true;
        }
        default:
            return null;
    }
}


module.exports = function ChernobyL(Local) {
    if (Local && process.env["REPL_ID"]) {
        return {
            set: Lset,
            get: Lget,
            has: Lhas,
            delete: Lremove,
            deleteMultiple: LremoveMultiple,
            list: Llist
        };
    } else if (!Local && process.env["REPL_ID"]) {
        return {
            set: Replit_Set,
            get: Replit_Get,
            has: Replit_Has,
            delete: Replit_Remove,
            deleteMultiple: Replit_RemoveMultiple,
            list: Replit_List
        };
    }
    else if (Local && !process.env["REPL_ID"]) {
        return {
            set: Lset,
            get: Lget,
            has: Lhas,
            delete: Lremove,
            deleteMultiple: LremoveMultiple,
            list: Llist
        };
    }
    else if (!Local && !process.env["REPL_ID"]) {
        return {
            set: Lset,
            get: Lget,
            has: Lhas,
            delete: Lremove,
            deleteMultiple: LremoveMultiple,
            list: Llist
        };
    }
    else {
        return {
            set: Lset,
            get: Lget,
            has: Lhas,
            delete: Lremove,
            deleteMultiple: LremoveMultiple,
            list: Llist
        };
    }
};