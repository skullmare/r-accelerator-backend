import supertest from 'supertest';
import app from '../../app.js';

function truncate(obj, maxLen = 300) {
    const str = JSON.stringify(obj, null, 2);
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

class ApiRequest {
    constructor(method, url) {
        this._method = method;
        this._url = url;
        this._st = supertest(app)[method.toLowerCase()](url);
        this._body = undefined;
    }

    set(...args) {
        this._st = this._st.set(...args);
        return this;
    }

    send(body) {
        this._body = body;
        this._st = this._st.send(body);
        return this;
    }

    then(resolve, reject) {
        return this._st.then((res) => {
            const bodyLine = this._body !== undefined
                ? `\n      body     ${truncate(this._body)}`
                : '';
            const dataLine = res.body?.data !== undefined
                ? truncate(res.body.data)
                : res.body?.message ?? JSON.stringify(res.body);

            console.log(
                `\n      ➜ ${this._method} ${this._url}${bodyLine}` +
                `\n      ← ${res.status}  ${dataLine}`
            );
            return resolve ? resolve(res) : res;
        }, reject);
    }

    catch(onRejected) {
        return this.then(undefined, onRejected);
    }
}

const api = {
    get:    (url) => new ApiRequest('GET',    url),
    post:   (url) => new ApiRequest('POST',   url),
    patch:  (url) => new ApiRequest('PATCH',  url),
    put:    (url) => new ApiRequest('PUT',    url),
    delete: (url) => new ApiRequest('DELETE', url),
};

export default api;
