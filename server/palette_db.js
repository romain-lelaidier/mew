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
            return this.connection.query({
                name: 'save-palette',
                text: 'INSERT INTO palettes (id, p) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET id = $1, p = $2',
                values: [ id, str ]
            });
        } else {
            return new Promise((resolve, reject) => { resolve() });
        }
    }

    loadPalette(id) {
        return new Promise(async (resolve, reject) => {
            try {
                var res = await this.connection.query({
                    name: 'load-palette',
                    text: 'SELECT * FROM palettes WHERE id = $1',
                    values: [ id ]
                });
                if (res.rowCount == 0) return reject("No palette saved for id " + id);
                resolve(JSON.parse(res.rows[0].p));
            } catch(err) {
                reject(err)
            }
        })
    }
}

module.exports = PaletteDB;
