$(function () {
    $('#searched-user').keydown(function (event) {
        if (event.keyCode === 13) {
            $('#search-button').click();
        }
    });

    // Renders the user's avatar
    function renderAvatar(user) {
        $.getJSON("http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=" + encodeURIComponent(user) + "&api_key=287bf7be3a6bde9f6174c639a306b459&format=json", function (data) {
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
            $('#results').append("<div class='album'>"
                + "<p class='number'>#" + (i + 1) + "</p>"
                + "<img src='" + data.topalbums.album[i].image[2]['#text'] + "' alt='" + data.topalbums.album[i].name + "'>"
                + "<div class='metadata'> <p class='album-name'>" + data.topalbums.album[i].name + "</p>"
                + "<p class='artist-name'>" + data.topalbums.album[i].artist.name + "</p>"
                + "<p>" + Intl.NumberFormat().format(data.topalbums.album[i].playcount) + " plays</p></div>"
                + "</div>");
        }
    }

    // Response shape: data.topartists.artist[] — each item has: name, playcount, image[2]['#text']
    // Heads up: Last.fm's artist images are all the same gray placeholder. You may want to omit the <img>.
    function renderArtists(data) {
        for (var i = 0; i < Math.min(10, data.topartists.artist.length); i++) {
            $('#results').append("<div class='artist'>"
                + "<p class='number'>#" + (i + 1) + "</p>"
                + "<p class='artist-name'>" + data.topartists.artist[i].name + "</p>"
                + "<p>" + Intl.NumberFormat().format(data.topartists.artist[i].playcount) + " plays</p>"
                + "</div>");
        }
    }

    // Response shape: data.toptracks.track[] — each item has: name, playcount, artist.name (artist is a nested object)
    // Heads up: this endpoint does NOT return images.
    function renderTracks(data) {
        for (var i = 0; i < Math.min(10, data.toptracks.track.length); i++) {
            $('#results').append("<div class='track'>"
                + "<p class='number'>#" + (i + 1) + "</p>"
                + "<p class='track-name'>" + data.toptracks.track[i].name + "</p>"
                + "<p class='artist-name2'>" + data.toptracks.track[i].artist.name + "</p>"
                + "<p>" + Intl.NumberFormat().format(data.toptracks.track[i].playcount) + " plays</p>"
                + "</div>");
        }
    }

    // Function to search for top album, artist, or track based on the filter
    function search(user, filter) {
        $('#results').empty()

        $.getJSON("http://ws.audioscrobbler.com/2.0/?method=user." + encodeURIComponent(filter) + "&period=7day&user=" + encodeURIComponent(user) + "&api_key=287bf7be3a6bde9f6174c639a306b459&format=json", function (data) {
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




});