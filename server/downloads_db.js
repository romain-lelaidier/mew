class DownloadsDB {
    constructor(connection) {
        this.connection = connection
    }
    
    init() {
        return this.connection.query(`CREATE TABLE IF NOT EXISTS downloads (
                id VARCHAR(11) NOT NULL,
                title VARCHAR(128),
                album VARCHAR(128),
                artist VARCHAR(128),
                duration INT,
                smallThumb VARCHAR(256),
                progress INT,
                time DATETIME,
                PRIMARY KEY (id)
        )`);
    }

    addDownload(info) {
        return this.connection.query(
            `INSERT INTO downloads (id, title, album, artist, duration, smallThumb, progress, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [ info.id, info.title, info.album, info.artist, info.duration, info.smallThumb, -1, new Date() ]
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

    loadAll() {
        return new Promise((resolve, reject) => {
            this.connection.query(
                `SELECT * FROM downloads ORDER BY time DESC`
            ).then(res => {
                resolve(res[0])
            }).catch(reject)
        })
    }
}

module.exports = DownloadsDB;
