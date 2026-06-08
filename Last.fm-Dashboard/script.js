$(function () {
    // Tracks the currently searched user so popover detail calls can request per-user scrobbles.
    var currentUser = "";

    $('#searched-user').keydown(function (event) {
        if (event.keyCode === 13) {
            $('#search-button').click();
        }
    });

    // Renders the user's avatar
    function renderAvatar(user) {
        $.getJSON("https://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=" + encodeURIComponent(user) + "&api_key=287bf7be3a6bde9f6174c639a306b459&format=json", function (data) {
            if (data.error) {
                $('#avatar').addClass('hidden');
                return;
            }

            $('#avatar-image').attr('src', data.user.image[2]['#text']);
            $('#avatar').removeClass('hidden');
            $('#username').text(data.user.name);
            $('#playcount').text("" + Intl.NumberFormat().format(data.user.playcount) + " plays");
        });
    }

    // Renders top albums into #results.
    // Response shape: data.topalbums.album[] — each item has: name, playcount, artist.name, image[2]['#text']
    function renderAlbums(data) {
        for (var i = 0; i < Math.min(10, data.topalbums.album.length); i++) {
            var album = data.topalbums.album[i];
            var $card = $("<div class='album'>"
                + "<p class='number'>#" + (i + 1) + "</p>"
                + "<img src='" + album.image[2]['#text'] + "' alt='" + album.name + "'>"
                + "<div class='metadata'> <p class='album-name'>" + album.name + "</p>"
                + "<p class='artist-name'>" + album.artist.name + "</p>"
                + "<p>" + Intl.NumberFormat().format(album.playcount) + " plays</p></div>"
                + "</div>");
            // Set identifiers via attr() (not string concat) so names with quotes can't break the markup.
            $card.attr({ 'data-type': 'album', 'data-artist': album.artist.name, 'data-name': album.name });
            $('#results').append($card);
        }
    }

    // Response shape: data.topartists.artist[] — each item has: name, playcount, image[2]['#text']
    // Last.fm only returns placeholder artist images, so the photo is fetched separately from Deezer.
    function renderArtists(data) {
        for (var i = 0; i < Math.min(10, data.topartists.artist.length); i++) {
            var artist = data.topartists.artist[i];
            var $card = $("<div class='artist'>"
                + "<p class='number'>#" + (i + 1) + "</p>"
                + "<img class='hidden' alt='" + artist.name + "'>"
                + "<div class='metadata'><p class='artist-name'>" + artist.name + "</p>"
                + "<p>" + Intl.NumberFormat().format(artist.playcount) + " plays</p></div>"
                + "</div>");
            $card.attr({ 'data-type': 'artist', 'data-artist': artist.name });
            $('#results').append($card);

            fetchArtistImage(artist.name, $card.find('img'));
        }
    }

    // Response shape: data.toptracks.track[] — each item has: name, playcount, artist.name (artist is a nested object)
    // This endpoint does NOT return images, so the album cover is fetched separately via track.getInfo.
    function renderTracks(data) {
        for (var i = 0; i < Math.min(10, data.toptracks.track.length); i++) {
            var track = data.toptracks.track[i];
            var $card = $("<div class='track'>"
                + "<p class='number'>#" + (i + 1) + "</p>"
                + "<img class='hidden' alt='" + track.name + "'>"
                + "<div class='metadata'><p class='track-name'>" + track.name + "</p>"
                + "<p class='artist-name2'>" + track.artist.name + "</p>"
                + "<p>" + Intl.NumberFormat().format(track.playcount) + " plays</p></div>"
                + "</div>");
            $card.attr({ 'data-type': 'track', 'data-artist': track.artist.name, 'data-name': track.name });
            $('#results').append($card);

            fetchTrackImage(track.artist.name, track.name, $card.find('img'));
        }
    }

    // Fetches a track's album cover via Last.fm track.getInfo (gettoptracks omits images).
    // Reveals the <img> only once a real URL is found; otherwise the card stays text-only.
    function fetchTrackImage(artist, track, $img) {
        $.getJSON("https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist="
            + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track)
            + "&api_key=287bf7be3a6bde9f6174c639a306b459&format=json", function (data) {
            var images = data && data.track && data.track.album && data.track.album.image;
            if (images) {
                // Prefer extralarge (image[3], ~300px) and fall back to large (image[2], ~174px).
                var url = (images[3] && images[3]['#text']) || (images[2] && images[2]['#text']);
                if (url) {
                    $img.attr('src', url).removeClass('hidden');
                }
            }
        });
    }

    // Fetches a real artist photo from Deezer. Deezer doesn't send CORS headers but supports
    // JSONP (output=jsonp + callback), which jQuery's jsonp dataType wires up automatically.
    function fetchArtistImage(artist, $img) {
        $.ajax({
            url: "https://api.deezer.com/search/artist",
            data: { q: artist, limit: 1, output: "jsonp" },
            dataType: "jsonp",
            success: function (data) {
                var match = data && data.data && data.data[0];
                var url = match && (match.picture_big || match.picture_medium);
                if (url) {
                    $img.attr('src', url).removeClass('hidden');
                }
            }
        });
    }

    // Function to search for top album, artist, or track based on the filter
    function search(user, filter) {
        currentUser = user;
        $('#popover').addClass('hidden');
        $('#results').empty()

        $.getJSON("https://ws.audioscrobbler.com/2.0/?method=user." + encodeURIComponent(filter) + "&period=7day&user=" + encodeURIComponent(user) + "&api_key=287bf7be3a6bde9f6174c639a306b459&format=json", function (data) {
            if (data.error) {
                $('#results').append("<p class='error'>" + data.message + "</p>");
                return;
            }

            if (filter === 'gettopalbums') {
                renderAlbums(data);
            } else if (filter === 'gettopartists') {
                renderArtists(data);
            } else if (filter === 'gettoptracks') {
                renderTracks(data);
            }
        }).fail(function (jqXHR) {
            const msg = jqXHR.responseJSON && jqXHR.responseJSON.message
                ? jqXHR.responseJSON.message
                : "Couldn't reach Last.fm. Please try again.";
            $('#results').append("<p class='error'>" + msg + "</p>");
        });
    }

    // Click handler for the search button
    $('#search-button').click(function () {
        const user = $('#searched-user').val();
        if (user === "") {
            alert("Enter a username 🎃");
            return;
        }
        $('#box').animate({
            left: '250px',
            height: '150px',
            width: '150px',
            opacity: 0.5
        }, 1000);

        renderAvatar(user);

        const filter = $('.filter-button.active').data('filter');
        search(user, filter);
    });

    $('.filter-button').click(function () {
        $('.filter-button').removeClass('active');
        $(this).addClass('active');

        const user = $('#searched-user').val();
        if (user === "") return;

        const filter = $(this).data('filter');
        search(user, filter);
    });


    // ---- Detail popover ----------------------------------------------------
    // Clicking a card opens a small popover with global plays, the user's own
    // scrobbles, tags (all from Last.fm getInfo) and, for albums/tracks, the
    // release year (from Deezer, since Last.fm doesn't expose it reliably).

    // Bumped on every open so stale async responses from a previous card are ignored.
    var popoverToken = 0;

    $('#results').on('click', '.album, .artist, .track', function (event) {
        event.stopPropagation(); // don't let the document handler immediately close it
        var $card = $(this);
        openPopover($card, {
            type: $card.attr('data-type'),
            artist: $card.attr('data-artist'),
            name: $card.attr('data-name')
        });
    });

    function openPopover($card, item) {
        var token = ++popoverToken;
        var $pop = $('#popover');

        $('#popover-title').text(item.type === 'artist' ? item.artist : item.name);
        if (item.type === 'artist') {
            $('#popover-subtitle').addClass('hidden').text('');
        } else {
            $('#popover-subtitle').text(item.artist).removeClass('hidden');
        }
        $('#popover-year').addClass('hidden').text('');
        $('#popover-stats').html("<p class='popover-loading'>Loading…</p>");
        $('#popover-tags').empty();

        // Reveal (invisibly) so it can be measured, position it, then show.
        $pop.css('visibility', 'hidden').removeClass('hidden');
        positionPopover($pop, $card);
        $pop.css('visibility', '');

        fetchDetails(item, token);
        if (item.type === 'album' || item.type === 'track') {
            fetchYear(item, token);
        }
    }

    function positionPopover($pop, $card) {
        var rect = $card[0].getBoundingClientRect();
        var pw = $pop.outerWidth();
        var ph = $pop.outerHeight();
        var margin = 10;

        var left = rect.right + margin;           // prefer the right of the card
        if (left + pw > window.innerWidth - 8) {
            left = rect.left - pw - margin;        // not enough room -> flip to the left
        }
        left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));

        var top = rect.top;
        top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));

        $pop.css({ left: left + 'px', top: top + 'px' });
    }

    // Pulls stats + tags from Last.fm. username= makes getInfo include the user's own playcount.
    function fetchDetails(item, token) {
        var base = "https://ws.audioscrobbler.com/2.0/?api_key=287bf7be3a6bde9f6174c639a306b459"
            + "&format=json&username=" + encodeURIComponent(currentUser);
        var url;
        if (item.type === 'artist') {
            url = base + "&method=artist.getInfo&artist=" + encodeURIComponent(item.artist);
        } else if (item.type === 'album') {
            url = base + "&method=album.getInfo&artist=" + encodeURIComponent(item.artist)
                + "&album=" + encodeURIComponent(item.name);
        } else {
            url = base + "&method=track.getInfo&artist=" + encodeURIComponent(item.artist)
                + "&track=" + encodeURIComponent(item.name);
        }

        $.getJSON(url, function (data) {
            if (token !== popoverToken) return; // a newer card was clicked
            var entity = data && (data.artist || data.album || data.track);
            if (!entity) {
                $('#popover-stats').html("<p class='popover-loading'>No details found.</p>");
                return;
            }
            renderStats(entity, item.type);
            renderTags(entity, item.type);
        }).fail(function () {
            if (token !== popoverToken) return;
            $('#popover-stats').html("<p class='popover-loading'>Couldn't load details.</p>");
        });
    }

    function renderStats(entity, type) {
        // Artists nest counts under stats{}; albums/tracks expose them on the entity itself.
        var stats = (type === 'artist') ? (entity.stats || {}) : entity;
        var html = statRow("User's scrobbles", stats.userplaycount)
            + statRow("Total plays", stats.playcount)
            + statRow("Listeners", stats.listeners);
        $('#popover-stats').html(html || "<p class='popover-loading'>No stats available.</p>");
    }

    function statRow(label, value) {
        if (value === undefined || value === null || value === "") return "";
        var num = Number(value);
        var display = isNaN(num) ? value : Intl.NumberFormat().format(num);
        return "<div class='popover-stat'><span>" + label + "</span><span>" + display + "</span></div>";
    }

    function renderTags(entity, type) {
        // Tags live under toptags for tracks, but tags for artists/albums.
        var tagList = (type === 'track')
            ? (entity.toptags && entity.toptags.tag)
            : (entity.tags && entity.tags.tag);
        if (tagList && !Array.isArray(tagList)) tagList = [tagList]; // single tag comes back as an object
        var $tags = $('#popover-tags').empty();
        if (!tagList) return;
        for (var i = 0; i < Math.min(5, tagList.length); i++) {
            $tags.append($("<span class='tag'></span>").text(tagList[i].name));
        }
    }

    // Last.fm has no reliable release year, so resolve it from Deezer: search for the
    // album/track to get its id, then read release_date off the full object.
    function fetchYear(item, token) {
        var path = (item.type === 'album') ? 'album' : 'track';
        var q = 'artist:"' + item.artist + '" ' + path + ':"' + item.name + '"';
        $.ajax({
            url: "https://api.deezer.com/search/" + path,
            data: { q: q, limit: 1, output: "jsonp" },
            dataType: "jsonp",
            success: function (res) {
                if (token !== popoverToken) return;
                var match = res && res.data && res.data[0];
                if (!match) return;
                $.ajax({
                    url: "https://api.deezer.com/" + path + "/" + match.id,
                    data: { output: "jsonp" },
                    dataType: "jsonp",
                    success: function (detail) {
                        if (token !== popoverToken) return;
                        var date = detail && detail.release_date;
                        if (date && date.length >= 4) {
                            $('#popover-year').text("Released " + date.slice(0, 4)).removeClass('hidden');
                        }
                    }
                });
            }
        });
    }

    // Dismiss the popover: close button, click outside, Esc, or scroll/resize (it's anchored to the viewport).
    $('#popover-close').on('click', function () {
        $('#popover').addClass('hidden');
    });
    $(document).on('click', function (event) {
        if (!$(event.target).closest('#popover').length) {
            $('#popover').addClass('hidden');
        }
    });
    $(document).on('keydown', function (event) {
        if (event.keyCode === 27) $('#popover').addClass('hidden');
    });
    $(window).on('scroll resize', function () {
        $('#popover').addClass('hidden');
    });

});