### MusicResult
- `<String> type` : peut prendre les valeurs `SONG`, `ALBUM`, `ARTIST`
- `<Object> info` : objet contenant les données. Sa structure dépend du type spécifié.
- `<Bool> top` : vaut `true` si le résultat est le résultat mis en avant par YouTube.

### Thumbnail
- `<String> url` : URL de l'image
- `<Int> width` : largeur de l'image
- `<Int> height` : hauteur de l'image

### SongResult
- `<String[11]> id` : identifiant YouTube de la vidéo
- `<String> title` : titre de la chanson
- `<String[]> artistId` : identifiant YouTube de l'artiste
- `<String> artist` : nom de l'artiste
- `<String[17]> albumId` : identifiant YouTube de l'album
- `<String> album` : nom de l'album
- `<Int> year` : date de sortie de l'album
- `<Int> duration` : durée de la chanson (en secondes)
- `<Int> viewCount` : nombre de vues de la chanson sur YouTube
- `<Int> index` : index de la chanson, si elle trouvée à partir d'un album
- `<List<Thumbnail>> thumbnails` : liste contenant toutes les miniatures disponibles pour le titre
- `<String[17]> queueId` : identifiant YouTube de la playlist de lecture associée
- `<String> streamUrl` : URL du stream `webm` audio de la meilleure qualité

### VideoResult
Même structure que `SongResult`, en retirant le champ `index` et en renommant `artist` en `author`.

### AlbumResult
- `<String[17]> id` : identifiant YouTube de l'album
- `<String> title` : titre de l'album
- `<String[]> artistId` : identifiant YouTube de l'artiste
- `<String> artist` : nom de l'artiste
- `<Int> year` : date de sortie de l'album
- `<List<Thumbnail>> thumbnails` : liste contenant toutes les miniatures disponibles pour l'album
- `<List<AlbumSongResult>> songs` : liste des chansons de l'album

### AlbumSongResult
- `<String[11]> id` : identifiant YouTube de la vidéo
- `<String> title` : titre de la chanson
- `<Int> viewCount` : nombre de vues sur YouTube
- `<Int> duration` : durée de la chanson (en secondes)
- `<Int> index` : index dans l'album