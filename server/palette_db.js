class PaletteDB {
    constructor(connection) {
        this.connection = connection;
    }

    init() {
        return this.connection.query(`CREATE TABLE IF NOT EXISTS palettes (
            id VARCHAR(17) NOT NULL,
            p VARCHAR(256) NOT NULL,
            PRIMARY KEY (id)
        )`);
    }

    savePalette(id, palette) {
        var str = JSON.stringify(palette);
        if (id.length <= 17 && str.length <= 256) {
            return this.connection.query(
                `REPLACE INTO palettes (id, p) VALUES (?, ?)`,
                [ id, str ]
            )
        } else {
            return new Promise((resolve, reject) => { resolve() });
        }
    }

    loadPalette(id) {
        return new Promise(async (resolve, reject) => {
            try {
                var [ results, fields ] = await this.connection.query(
                    'SELECT * FROM palettes WHERE `id` = ?',
                    [ id ]
                );
                resolve(JSON.parse(results[0].p));
            } catch(err) {
                reject(err)
            }
        })
    }
}

module.exports = PaletteDB;
