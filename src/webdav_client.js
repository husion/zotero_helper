import { Logger } from './utils.js';

export class WebDAVClient {
    constructor(url, username, password) {
        this.url = url;
        this.username = username;
        this.password = password;
    }

    getAuthHeader() {
        return {
            'Authorization': 'Basic ' + btoa(this.username + ':' + this.password)
        };
    }

    async propfind(path) {
        const fullUrl = this.url + path;
        Logger.info(`WebDAV PROPFIND: ${fullUrl}`);
        const response = await fetch(fullUrl, {
            method: 'PROPFIND',
            headers: {
                ...this.getAuthHeader(),
                'Depth': '0'
            }
        });

        if (!response.ok) {
            throw new Error(`WebDAV PROPFIND failed: ${response.status} ${response.statusText}`);
        }

        return await response.text();
    }

    async get(path) {
        const fullUrl = this.url + path;
        Logger.info(`WebDAV GET: ${fullUrl}`);

        let response;
        try {
            response = await fetch(fullUrl, {
                method: 'GET',
                headers: this.getAuthHeader()
            });
        } catch (error) {
            throw new Error(`WebDAV request blocked or unreachable for ${fullUrl}: ${error.message}`);
        }

        if (!response.ok) {
            throw new Error(`WebDAV GET failed: ${response.status} ${response.statusText}`);
        }

        return await response.arrayBuffer();
    }
}
