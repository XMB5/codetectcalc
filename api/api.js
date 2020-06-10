const MongoClient = require('mongodb').MongoClient;
const debug = require('debug')('virusdata:api');
const {promisify} = require('util');
const http = require('http');

const maxRequestBodyLen = 1000;

const requestJsonSchema = {
    bsonType: 'object',
    required: ['a', 'b', 'c', 'd', 'lat', 'lng', 'email', 'institution', 'ip', 'uid', '_id', 'patientAgeMin', 'patientAgeMax', 'startDate', 'endDate'],
    properties: {
        a: {
            bsonType: 'int'
        },
        b: {
            bsonType: 'int'
        },
        c: {
            bsonType: 'int',
        },
        d: {
            bsonType: 'int'
        },
        lat: {
            type: 'number'
        },
        lng: {
            type: 'number'
        },
        email: {
            type: 'string'
        },
        institution: {
            type: 'string'
        },
        ip: {
            type: 'string'
        },
        uid: {
            type: 'string'
        },
        startDate: {
            bsonType: 'date'
        },
        endDate: {
            bsonType: 'date'
        },
        patientAgeMin: {
            bsonType: 'int'
        },
        patientAgeMax: {
            bsonType: 'int'
        },
        _id: {
            bsonType: 'objectId'
        }
    },
    additionalProperties: false

};

class VirusdataAPI {

    async main() {

        debug('started');
        await this.connectToDb();
        await this.startHttpServer();

    }

    async connectToDb() {

        debug('connecting to mongodb at ' + process.env.MONGO_URL);

        this.mongo = new MongoClient(process.env.MONGO_URL, {
            useUnifiedTopology: true,
            auth: {
                user: process.env.MONGO_USERNAME,
                password: process.env.MONGO_PASSWORD
            }
        });
        await this.mongo.connect();
        this.db = this.mongo.db('virusdata');
        await this.db.collection('shrekshrok').insertOne({shrek:1});
        const collections = await this.db.listCollections({
            name: 'shares'
        }, {
            nameOnly: true
        }).toArray();
        if (collections.length > 0) {
            //collection already exists
            this.collection = this.db.collection('shares');
        } else {
            debug('creating new collection');
            this.collection = await this.db.createCollection('shares', {
                validator: {
                    $jsonSchema: requestJsonSchema
                }
            });
        }

        debug('connected to mongodb');

    }

    async startHttpServer() {

        const port = parseInt(process.env.HTTP_PORT) || 80;
        debug('starting http server on port ' + port);
        this.httpServer = http.createServer((req, res) => {
            debug(req.url);
            if (req.headers['x-no-csrf'] === '1') {
                if (req.url === '/share' && req.method === 'POST') {
                    return this.handleShare(req, res);
                } else if (req.url === '/listdata' && req.method === 'GET') {
                    return this.handleListData(req, res);
                }
            }
            //fallback
            res.writeHead(400);
            res.end();
        });
        await promisify(this.httpServer.listen).bind(this.httpServer)(port);
        debug('started http server');

    }

    handleShare(req, res) {
        let len = 0;
        let chunks = [];
        let error = false;
        debug(req.headers);
        req.on('error', e => {
            error = true;
            debug('request error', e);
            res.writeHead(500);
            res.end();
        });
        req.on('end', async () => {
            if (error) {
                return;
            }
            let buf = Buffer.concat(chunks, len);
            try {
                let info = JSON.parse(buf.toString());
                info['ip'] = req.headers['x-forwarded-for'];
                info['uid'] = VirusdataAPI.getUidCookie(req);
                info['startDate'] = new Date(Date.UTC(info.startYear, info.startMonth - 1)); //month -1 because Date.UTC takes 0 as january
                delete info.startYear;
                delete info.startMonth;
                info['endDate'] = new Date(Date.UTC(info.endYear, info.endMonth - 1));
                delete info.endYear;
                delete info.endMonth;
                debug('insert', info);
                await this.collection.insertOne(info);
                res.writeHead(204);
                res.end();
            } catch (e) {
                debug('error processing request', e);
                res.writeHead(400);
                res.end();
            }
        });
        req.on('data', chunk => {
            len += chunk.length;
            if (len > maxRequestBodyLen) {
                error = true;
                debug(`maximum request body length (${maxRequestBodyLen} bytes) exceeded`);
                req.destroy();
            } else {
                chunks.push(chunk);
            }
        });
    }

    async handleListData(req, res) {
        const obj = await this.collection.find({}, {
            projection: {lat: 1, lng: 1, a: 1, b: 1, c: 1, d: 1, institution: 1, startDate: 1, endDate: 1, _id: 0}
        }).toArray();
        res.writeHead(200, {
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(obj));
    }

    static getUidCookie(req) {
        const cookieHeader = req.headers['cookie'];
        if (!cookieHeader) return;
        return cookieHeader
            .split(';')
            .map(c => c.trim())
            .filter(c => c.startsWith('uid='))
            .map(c => c.substring(4))[0];
    }

}

let virusdataApi = new VirusdataAPI();
virusdataApi.main();