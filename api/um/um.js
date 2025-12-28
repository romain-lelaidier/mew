import bcrypt from "bcryptjs";
import jsonwebtoken from "jsonwebtoken";
import { transporter, validateEmail } from "../mail/mail.js";

function generateId(len=32) {
  let uid = '';
  let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < len; i++) {
    uid += chars[Math.floor(Math.random() * chars.length)];
  }
  return uid;
}

async function sendVerificationEmail(email, id, verificationToken) {
  const url = `${process.env.LOCATION_WEB}verify/${id}/${verificationToken}`;
  console.log(`Sending verification link to [${email}]: ${url}`);

  try {
    await transporter.sendMail({
      from: `"Mew" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Mew - email verification",
      html: `Hi <b>user-${id}</b>,<br/><br/>Welcome to Mew !<br/><br/>Before logging in, please verify your email using the following link :<br/><br/><a href="${url}">Verify</a><br/><br/>Have a great time on the website !`, // plain‑text body
    });
  } catch(error) {
    console.log(`Could not send email: ${error.message}`);
  }
}

export function addUMFunctions(app, db) {

  /* USER MANAGEMENT */

  async function generateFreeId(collection, field, len=32) {
    /* Generates an id of length len, that is not used by any document as the field 'field' of the collection called 'collection' */
    while (true) {
      var uid = generateId(len);
      var query = {};
      query[field] = { $eq: uid }
      var r = await db.collection(collection).findOne(query);
      if (!r) return uid;
    }
  }

  function comparePasswords(user, password) {
    /* Returns true if the given password is the password of the given user */
    return bcrypt.compareSync(password, user.hash);
  }

  async function generateJWT(id) {
    /* Generates a JSON Web Token for the user whose id is given as an argument */
    const user = await db.collection("users").findOne({ id: { $eq: id } });
    if (!user) throw new Error("This user does not exist.");
    return jsonwebtoken.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '10d' });
  }

  function getUserFromJWT(token) {
    return new Promise((resolve, reject) => {
      jsonwebtoken.verify(token, process.env.JWT_SECRET, async (error, jwtuser) => {
        try {
          if (error) return reject(error);
          const user = await db.collection("users").findOne({ id: { $eq: jwtuser.id } });
          if (!user) return reject(new Error("This user does not exist."));
          if (!user.verified) return reject(new Error("Your account is not verified. Please check your inbox before logging in."));
          resolve(user);
        } catch(error) {
          reject(error);
        }
      });
    })
  }

  async function getUserFromReq(req) {
    const token = req.headers.authorization;
    if (token) return getUserFromJWT(token);
  }

  async function authenticateJWT(req, res, next) {
    /* If the request headers object contains a JWT, it means that a user is logged in. In that case, the function loads the user profile to the request object as req.user. */
    const token = req.headers.authorization;
    if (token) {
      try {
        const user = await getUserFromJWT(token);
        req.user = user;
        next();
      } catch(error) {
        res.status(400).json({ error: "No token provided."});
      }
    } else {
      res.status(400).json({ error: "No token provided."});
    }
  }

  app.post('/um/signup', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) throw new Error("Incorrect request.");

      var existingUser = await db.collection("users").findOne({
        email: { $eq: email }
      });
      if (existingUser) throw new Error("There is already an account associated with this email. Please login instead or use a different email.");

      if (!validateEmail(email)) throw new Error("Invalid email.");

      const id = await generateFreeId("users", "id", 6);
      const verificationToken = await generateFreeId("users", "verificationToken", 32);

      await db.collection("users").insertOne({
        id, email,
        hash: bcrypt.hashSync(password), verificationToken
      })

      sendVerificationEmail(email, id, verificationToken);

      res.status(201).json({ message: "Your account was created. Please check your inbox to verify your account." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/um/verify', async (req, res) => {
    try {
      const { id, verificationToken } = req.body;
      const user = await db.collection("users").findOne({
        $and: [
          { id: { $eq: id } },
          { verificationToken: { $eq: verificationToken } }
        ]
      });
      if (!user) throw new Error("Invalid token.");

      await db.collection("users").updateOne(
        { id: { $eq: id } },
        {
          $set: { verified: true },
          $unset: { verificationToken: "" }
        }
      )

      // create history playlist
      const pid = await generateFreeId("playlists", "id", 10);
      const playlist = {
        pid, ids: [], history: true,
        owners: [id], private: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection("playlists").insertOne(playlist);

      const token = await generateJWT(id);
      res.status(200).json({ id, token });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/um/login', async (req, res) => {
    try {
      if (!req.body.email) throw new Error("Field 'email' not specified.")
      if (!req.body.password) throw new Error("Field 'password' not specified.")
      const { email, password } = req.body;

      const user = await db.collection("users").findOne({ email: { $eq: email } });
      if (!user) throw new Error("This user does not exist.");
      if (!user.verified) throw new Error("Your account is not verified. Please check your inbox before logging in.");

      if (!comparePasswords(user, password)) throw new Error("Incorrect password.");

      const token = await generateJWT(user.id);
      res.status(200).json({ token, id: user.id, params: user.params });
    } catch(error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/um/relog', authenticateJWT, async (req, res) => {
    try {
      const token = await generateJWT(req.user.id);
      res.status(200).json({ token, id: req.user.id, params: req.user.params });
    } catch(error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/um/setparams', authenticateJWT, async (req, res) => {
    try {
      const params = req.user.params || {};
      const wanted = req.body.params;
      if ("name" in wanted && typeof wanted.name == "string") {
        params.name = wanted.name.substring(0, 32);
      }
      if ("iso" in wanted && ["wor","afr","asi","eur","noa","oce","soa","ab","af","ax","al","dz","as","ad","ao","ai","aq","ag","ar","am","aw","au","at","az","zo","bs","bh","bd","bb","by","be","bz","bj","bm","bt","bo","bq","ba","bw","br","io","vg","bn","bg","bf","mm","bi","kh","cm","ca","cv","ky","cf","td","cl","cn","cx","cc","co","km","cg","ck","cr","ci","hr","cu","cw","cy","cz","cd","dk","dj","dm","do","ec","eg","sv","gq","er","ee","sz","et","fk","fo","fj","fi","fr","gf","pf","ga","gm","ge","de","gh","gi","gr","gl","gd","gp","gu","gt","gg","gn","gw","gy","ht","hn","hk","hu","is","in","id","ir","iq","ie","im","il","it","jm","jp","je","jo","kz","ke","tf","ki","xk","kw","kg","la","lv","lb","ls","lr","ly","li","lt","lu","mo","mg","mi","mw","my","mv","ml","mt","mh","mq","mr","mu","yt","mx","fm","md","mc","mn","me","ms","ma","mz","na","nr","np","nl","nc","nz","ni","ne","ng","nu","nf","kp","mk","mp","no","om","pk","pw","ps","pa","pg","py","pe","ph","pn","pl","pt","pr","qa","re","ro","ru","rw","sh","kn","lc","pm","vc","bl","mf","ws","sm","st","sa","sn","rs","sc","sl","sg","sk","si","sb","so","za","gs","kr","ss","es","lk","sd","sr","se","ch","sy","tw","tj","tz","th","tl","tg","tk","to","tt","tn","tr","tm","tc","tv","ug","ua","ae","gb","us","um","vi","uy","uz","vu","va","ve","vn","wf","eh","ye","zm","zw","usal","usak","usaz","usar","usca","usco","usct","usde","usfl","usga","ushi","usid","usil","usin","usia","usks","usky","usla","usme","usmd","usma","usmi","usmn","usms","usmo","usmt","usne","usnv","usnh","usnj","usnm","usny","usnc","usnd","usoh","usok","usor","uspa","usri","ussc","ussd","ustn","ustx","usut","usvt","usva","uswa","uswv","uswi","uswy"].includes(wanted.iso)) {
        params.iso = wanted.iso;
      }
      await db.collection("users").updateOne(
        { id: { $eq: req.user.id } },
        { $set: { params } }
      );
      const token = await generateJWT(req.user.id);
      res.status(200).json({ token, id: req.user.id, params });
    } catch(error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/um/delete', authenticateJWT, async (req, res) => {
    try {
      if (!req.body.password) throw new Error("Field 'password' not specified.")
      const { password } = req.body;
      if (!comparePasswords(req.user, password)) throw new Error("Incorrect password.");

      await db.collection("users").deleteOne({ id: { $eq: req.user.id } });
      res.status(200).json({ message: "Account succesfully removed." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/um/pwchange', authenticateJWT, async (req, res) => {
    try {
      if (!req.body.password) throw new Error("Field 'password' not specified.")
      if (!req.body.newpassword) throw new Error("Field 'newpassword' not specified.")
      const { password, newpassword } = req.body;
      if (!comparePasswords(req.user, password)) throw new Error("Incorrect password.");

      await db.collection("users").updateOne(
        { id: { $eq: req.user.id } },
        { $set: { hash: bcrypt.hashSync(newpassword) } }
      );
      res.status(200).json({ message: "Password succesfully updated." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  /* PLAYLISTS */

  app.get('/um/user/:id', async (req, res) => {
    try {
      const user = await db.collection("users").findOne({ id: { $eq: req.params.id } });
      if (!user) throw new Error("This user does not exist.");

      const logged = await getUserFromReq(req);

      const response = {
        id: user.id,
        params: {}
      };
      if (user.params && 'name' in user.params) response.params.name = user.params.name;
      if (user.params &&  'iso' in user.params) response.params.iso  = user.params.iso;

      const playlists = await (await db.collection("playlists").find({ owners: user.id })).toArray();
      response.playlists = {};
      for (const playlist of playlists) {
        if (playlist.private && (!logged || !playlist.owners.includes(logged.id))) continue;
        response.playlists[playlist.pid] = {
          name: playlist.name,
          owners: playlist.owners,
          ids: playlist.ids,
          createdAt: playlist.createdAt,
          updatedAt: playlist.updatedAt
        }
      }

      res.status(200).json(response);
    } catch(error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/um/playlists', authenticateJWT, async (req, res) => {
    try {
      const playlists = await (await db.collection("playlists").find({ owners: req.user.id })).toArray();
      res.status(200).json(playlists);
    } catch(error) {
      res.status(400).json({ error: error.message });
    }
  })

  app.post('/pl/create', authenticateJWT, async (req, res) => {
    try {
      if (!req.body.name) throw new Error("Field 'name' not specified.");
      const pid = await generateFreeId("playlists", "id", 10);
      const { name, ids = [] } = req.body;
      const playlist = {
        pid, name, ids,
        owners: [req.user.id],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.collection("playlists").insertOne(playlist);
      res.status(201).json({ message: "Playlist created successfully.", playlist });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  async function isPlaylistOwner(req, res, next) {
    try {
      const playlist = await db.collection("playlists").findOne({
        $and: [
          { pid: { $eq: req.params.pid } },
          { owners: { $in: [req.user.id] } }
        ]
      });
      if (!playlist) throw new Error("Access denied. You are not an owner of this playlist.");
      req.playlist = playlist;
      next();
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  app.post('/pl/add/:pid/:id', authenticateJWT, isPlaylistOwner, async (req, res) => {
    try {
      const id = req.params.id;
      const video = await db.collection("songs").findOne({ id: { $eq: id } });
      if (!video) throw new Error("Unknown id. Please listen to the song before adding it to any playlist.");
      const playlist = await db.collection("playlists").findOne({ pid: { $eq: req.params.pid } });
      if (!playlist) throw new Error('Unkown playlist.');
      const ids = playlist.ids;
      // if (ids.includes(id)) ids.splice(ids.indexOf(id), 1);
      ids.unshift(id);
      await db.collection("playlists").updateOne(
        { pid: { $eq: req.params.pid } },
        { $set: {
          ids: ids,
          updatedAt: new Date()
        } }
      );
      res.status(200).json({ message: "Playlist updated successfully." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/pl/remove/:pid/:id', authenticateJWT, isPlaylistOwner, async (req, res) => {
    try {
      const id = req.params.id;
      const playlist = await db.collection("playlists").findOne({ pid: { $eq: req.params.pid } });
      if (!playlist) throw new Error('Unkown playlist.');
      const ids = playlist.ids;
      while (ids.includes(id)) ids.splice(ids.indexOf(id), 1);
      await db.collection("playlists").updateOne(
        { pid: { $eq: req.params.pid } },
        { 
          $set: { ids, updatedAt: new Date() }
        }
      );
      res.status(200).json({ message: "Playlist updated successfully." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/pl/rename/:pid', authenticateJWT, isPlaylistOwner, async (req, res) => {
    try {
      if (!req.body.name) throw new Error("Field 'name' not specified.");
      await db.collection("playlists").updateOne(
        { pid: { $eq: req.params.pid } },
        { $set: { 
          name: req.body.name,
          updatedAt: new Date()
        } }
      );
      res.status(200).json({ message: "Playlist updated successfully." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/pl/addowner/:pid', authenticateJWT, isPlaylistOwner, async (req, res) => {
    try {
      if (!req.body.email) throw new Error("Field 'email' not specified.");
      const user = await db.collection("users").findOne({ email: { $eq: req.body.email } });
      if (!user) throw new Error("Unknown user.");

      await db.collection("playlists").updateOne(
        { pid: { $eq: req.params.pid } },
        { $addToSet: { owners: user.id } }
      );
      res.status(200).json({ message: "Playlist updated successfully." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/pl/delete/:pid', authenticateJWT, isPlaylistOwner, async (req, res) => {
    try {
      await db.collection("playlists").deleteOne({ pid: { $eq: req.params.pid } });
      res.status(200).json({ message: "Playlist successfully removed." });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/pl/:pid', async (req, res) => {
    try {
      const playlist = await db.collection("playlists").findOne({ pid: { $eq: req.params.pid } });
      if (!playlist) throw new Error("Unknown playlist id.");

      if (playlist.private) {
        const user = await getUserFromReq(req);
        if (!user || !playlist.owners.includes(user.id)) throw new Error('This playlist is private.');
      }

      const owners = await (await db.collection("users").find({ id: { $in: playlist.owners } })).toArray();
      const songs = await (await db.collection("songs").find({ id: { $in: playlist.ids } })).toArray();

      res.status(200).json({
        pid: playlist.pid,
        name: playlist.name,
        createdAt: playlist.createdAt,
        history: playlist.history,
        owners: owners.map(owner => ({ id: owner.id, params: owner.params })),
        songs: playlist.ids.map(id => songs.filter(song => song.id == id)[0])
      })
    } catch(error) {
      res.status(400).json({ error: error.message });
    }
  });

  return authenticateJWT;

}