class PlayerDB {
    constructor(connection) {
        this.connection = connection;
    }
    
    init() {
        return this.connection.query(`CREATE TABLE IF NOT EXISTS players (
            pid VARCHAR(8) NOT NULL,
            plg VARCHAR(5) NOT NULL,
            sts INT NOT NULL,
            sfc VARCHAR(2048) NOT NULL,
            nfc VARCHAR(8192) NOT NULL,
            PRIMARY KEY (pid, plg)
        )`);
    }

    savePlayer(player) {
        if (!player.extracted) return reject("Player not extracted");
        // console.log("Saving player", player.pid, player.plg)
        return this.connection.query({
            name: 'save-player',
            text: 'INSERT INTO players (pid, plg, sts, sfc, nfc) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (pid, plg) DO UPDATE SET pid = $1, plg = $2, sts = $3, sfc = $4, nfc = $5',
            values: [ player.pid, player.plg, player.sts, player.sfc, player.nfc ]
        });
    }

    loadPlayer(player) {
        return new Promise(async (resolve, reject) => {
            // console.log("Loading player", player.pid, player.plg);
            try {
                var res = await this.connection.query({
                    name: 'fetch-player',
                    text: 'SELECT * FROM players WHERE pid = $1 AND plg = $2',
                    values: [ player.pid, player.plg ],
                });
                if (res.rowCount == 0) return reject("Player not saved");
                player.sts = res.rows[0].sts;
                player.sfc = res.rows[0].sfc;
                player.nfc = res.rows[0].nfc;
                player.extracted = true;
                resolve(player)
            } catch(err) {
                console.error(err);
                reject(err)
            }
        })
    }
}

module.exports = PlayerDB;
