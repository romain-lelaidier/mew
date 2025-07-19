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
                time TIMESTAMP,
                PRIMARY KEY (id)
        )`);
    }

    addDownload(info) {
        return this.connection.query({
            name: 'save-download',
            text: 'INSERT INTO downloads (id, title, album, artist, duration, smallThumb, progress, time) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO UPDATE SET id = $1, title = $2, album = $3, artist = $4, duration = $5, smallThumb = $6, progress = $7, time = $8',
            values: [ info.id, info.title, info.album, info.artist, info.duration, info.smallThumb, -1, new Date() ]
        });
    }

    updateProgress(id, progress) {
        return this.connection.query({
            name: 'update-download',
            text: 'UPDATE downloads SET progress = $1 WHERE id = $2',
            values: [ progress, id ],
        });
    }

    loadState(id) {
        return new Promise(async (resolve, reject) => {
            try {
                var res = await this.connection.query({
                    name: 'fetch-download',
                    text: 'SELECT * FROM downloads WHERE id = $1',
                    values: [ id ],
                });
                if (res.rowCount > 0) {
                    return resolve(res.rows[0]);
                }
                resolve(null)
            } catch(err) {
                reject(err)
            }
        })
    }

    loadAll() {
        return new Promise((resolve, reject) => {
            this.connection.query({
                name: 'fetch-alldownloads',
                text: 'SELECT * FROM downloads ORDER BY time DESC'
            }).then(res => {
                resolve(res.rows)
            }).catch(reject)
        })
    }
}

module.exports = DownloadsDB;
