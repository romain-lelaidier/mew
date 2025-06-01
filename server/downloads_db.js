const mysql = require('mysql2/promise');

class DownloadsDB {
    constructor(dbConfig) {
        this.dbConfig = dbConfig
    }
    
    init() {
        return new Promise(async (resolve, reject) => {
            this.connection = await mysql.createConnection(this.dbConfig);
            await this.connection.query(`CREATE TABLE IF NOT EXISTS downloads (
                id VARCHAR(11) NOT NULL,
                title VARCHAR(128),
                album VARCHAR(128),
                artist VARCHAR(128),
                duration INT,
                thumbnail VARCHAR(256),
                progress INT,
                time DATETIME,
                PRIMARY KEY (id)
            )`);
            resolve();
        })
    }

    addDownload(info) {
        return this.connection.query(
            `INSERT INTO downloads (id, title, album, artist, duration, thumbnail, progress, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ info.id, info.title, info.album, info.artist, info.duration, info.thumbnail, -1, new Date() ]
        )
    }

    updateProgress(id, progress) {
        return this.connection.query(
            `UPDATE downloads SET progress = ? WHERE id = ?`,
            [ progress, id ]
        )
    }

    loadState(id) {
        return new Promise(async (resolve, reject) => {
            try {
                var [ results, fields ] = await this.connection.query(
                    'SELECT * FROM downloads WHERE `id` = ?',
                    [ id ]
                );
                if (results.length > 0) {
                    return resolve(results[0]);
                }
                resolve(null)
            } catch(err) {
                reject(err)
            }
        })
    }
}

module.exports = DownloadsDB;
