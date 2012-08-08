/**
 * sendAsBinary
 * 
 * @url http://stackoverflow.com/questions/3743047/uploading-a-binary-string-in-webkit-chrome-using-xhr-equivalent-to-firefoxs-se
 */
if (!('sendAsBinary' in XMLHttpRequest.prototype)) {
    XMLHttpRequest.prototype.sendAsBinary = function(datastr) {
        function byteValue(x) {
            return x.charCodeAt(0) & 0xff;
        }

        var ords = Array.prototype.map.call(datastr, byteValue);
        var ui8a = new Uint8Array(ords);
        this.send(ui8a.buffer);
    }
}

var WebDAV = (function() {
    var request = function(type, url, allowCache) {
        // could add support for other versions here. lazy
        var xhr =  new XMLHttpRequest();

        // bust some cache
        if (!allowCache) {
            url += (url.indexOf('?') > -1 ? '&' : '?') + '_=' + Date.now();
        }

        xhr.open(type, url, true);

        return xhr;
    },
    getSize = function(s) {
        if (isNaN(parseInt(s))) {
            return false;
        }
        else {
            if (s.match(/K/)) {
                return parseInt(s) * 1024;
            }
            else if (s.match(/M/)) {
                return parseInt(s) * Math.pow(1024, 2);
            }
            else if (s.match(/G/)) {
                return parseInt(s) * Math.pow(1024, 3);
            }
            else if (s.match(/T/)) {
                return parseInt(s) * Math.pow(1024, 4);
            }
            else {
                return parseInt(s);
            }
        }
    },
    showSize = function(i) {
        if (i === false) {
            return '';
        }
        else if (i < 1024) {
            return '' + i + ' bytes';
        }
        else if (i < Math.pow(1024, 2)) {
            return '' + (i / 1024).toFixed(1) + ' KB';
        }
        else if (i < Math.pow(1024, 3)) {
            return '' + (i / Math.pow(1024, 2)).toFixed(1) + ' MB';
        }
        else if (i < Math.pow(1024, 4)) {
            return '' + (i / Math.pow(1024, 3)).toFixed(1) + ' GB';
        }
        else if (i < Math.pow(1024, 5)) {
            return '' + (i / Math.pow(1024, 4)).toFixed(1) + ' TB';
        }
    },
    sortFiles = function() {
        if (files.length) {
            files.sort(function(a, b) {
                if (a.directory == b.directory) {
                    return a.name.replace(/\/$/, '') < b.name.replace(/\/$/, '') ? -1 : 1;
                }
                else {
                    return a.directory ? -1 : 1;
                }
            });
        }

        $.each(files, function(i) {
            this.index = i;
        });

        return files;
    },
    createListItem = function(file) {
        file.item = $('<li/>').data('file', file);

        if (file.directory) {
            file.item.addClass('directory');
        }
        else {
            file.item.addClass('file');

            if (file.type) {
                file.item.addClass(file.type);
            }
            else {
                file.item.addClass('unknown');
            }
        }

        if (!file.directory) {
            file.item.addClass(file.name.replace(/^.+\.([^\.]+)$/, '$1'));
        }

        file.item.append('<a href="' + file.path + file.name + '" class="title">' + file.title + '</a>').append('<span class="size">' + showSize(file.size) + '</span>');

        if (file['delete']) {
            file.item.append('<a href="#delete" class="delete">&times;</a>');
        }

        return file.item;
    },
    bindEvents = function(file) {
        if (file.directory) {
            file.item.find('.title').on('click', function() {
                window.location = $(this).attr('href');

                return false;
            });
        }
        else {
            file.item.find('.title').on('click', function(event) {
                event.stopPropagation();

                var options = {
                    href: file.path + file.name
                };

                if (file.type != 'image') {
                    options.type = 'iframe';

                    // the following will only work if you're using the apache solution
                    options.beforeShow = function() {
                        // if we haven't loaded the script yet, lets just exit quietly
                        if (!prettyPrint) {
                            return;
                        }

                        // access the frame's document object
                        var w = $('.fancybox-iframe').prop('contentWindow'),
                        d = w.document;
                        $('pre', d).addClass('prettyprint').addClass('lang-' + file.name.replace(/^.+\.([^\.]+)$/, '$1'));
                        $('head', d).append('<link rel="stylesheet" type="text/css" href="' + getURL() + 'external/prettify/prettify.css" media="screen" />');
                        w.eval(prettyPrint);
                        w.prettyPrint();
                    }
                }

                if (file.type != 'unknown') {
                    $.fancybox(options);

                    return false;
                }
            });
        }

        if (file['delete']) {
            file.item.find('.delete').on('click', function() {
                if (confirm('Are you sure you want to delete "' + file.name + '"?')) {
                    WebDAV.del(file);
                }

                return false;
            });
        }

        file.item.on('click', function() {
            file.item.find('a.title').click();

            return false;
        });

        return file.item;
    },
    renderFiles = function() {
        sortFiles();

        list.empty();

        $.each(files, function(i, file) {
            if (!file) {
                return;
            }

            list.append(file.item);

            bindEvents(file);
        });

        return list;
    },
    checkFile = function(file) {
        var r = false;

        $.each(files, function() {
            if (this.name == file.name) {
                r = this;

                return false;
            }
        });

        return r;
    },
    getType = function(file) {
        var types = {
            // displayed in an iframe, using google prettify
            'text': /\.(?:te?xt|i?nfo|php|pl|cgi|faq|ini|htaccess|log|sql|sfv|conf|sh|pm|py|rb|css|js|java|coffee|sass|[sx]?html?|xml|svg)$/i,
            // displayed in fancybox as an image
            'image': /\.(?:jpe?g|gif|a?png)/i
        },
        // downloaded
        type = 'unknown';

        $.each(types, function(key, value) {
            if (file.match(value)) {
                type = key;

                return false;
            }
        });

        return type;
    },
    getURL = function() {
        var url = '/';

        $('script[src$="src/webdav-min.js"]').each(function() {
            url = $(this).attr('src').replace(/src\/webdav-min.js$/, '');
        });

        return url;
    },
    list = $('<ul class="list"/>'),
    dropper = $('div.upload'),
    path = window.location.pathname,
    files = [],
    prettyPrint = '';

    return {
        init: function() {
            // save the pretty print script so we only request it once
            $.getScript(getURL() + 'external/prettify/prettify.js', function(script) {
                prettyPrint = script;
            });

            // extract the data from the default directory listing
            $('div.content table').find('tr').each(function() {
                var cells;

                if ((cells = $(this).find('td')).length) {
                    // 0: icon
                    // 1: filename
                    // 2: modified
                    // 3: size
                    // 4: description (type)
                    var name = cells.filter(':eq(1)').text(),
                    title = name,
                    filepath = WebDAV.path();

                    if (title == 'Parent Directory') {
                        title = '&larr;';
                        name = '';
                        filepath = filepath.replace(/[^\/]+\/$/, '');
                    }

                    var file = {
                        'directory': !!cells.filter(':eq(0)').html().match(/DIR/),
                        'name': name,
                        'title': title,
                        'path': filepath,
                        'modified': new Date(cells.filter(':eq(2)').text()),
                        'size': getSize(cells.filter(':eq(3)').text()),
                        'type': getType(name),
                        'request': null,
                        'item': null,
                        'data': null,
                        'delete': (name == '' ? false : true)
                    };

                    createListItem(file);

                    files.push(file);
                }
            });

            // clear the content area and add the list
            $('div.content').empty().append(list);

            // render the nice list
            renderFiles();

            // drag and drop area
            dropper.on('dragover', function() {
                dropper.addClass('active');

                return false;
            });

            dropper.on('dragend dragleave', function(event) {
                dropper.removeClass('active');

                return false;
            });

            dropper.on('drop', function(event) {
                dropper.removeClass('active');

                var newFiles = event.originalEvent.target.files || event.originalEvent.dataTransfer.files;

                $.each(newFiles, function(i, file) {
                    if (existingFile = checkFile(file)) {
                        if (!confirm('A file called "' + existingFile.name + '" already exists, would you like to overwrite it?')) {
                            return false;
                        }
                        else {
                            delete files[existingFile.index];

                            sortFiles();

                            renderFiles();
                        }
                    }

                    if (typeof FileReader != 'undefined') {
                        var fileReader = new FileReader();

                        fileReader.addEventListener('load', function(event) {
                            file.data = event.target.result;

                            WebDAV.upload(file);
                        }, false);

                        fileReader.context = WebDAV;
                        fileReader.filename = file.name;
                        fileReader.readAsBinaryString(file);
                    }
                    else {
                        // TODO: support other browsers - flash fallback
                        alert('Sorry, your browser isn\'t currently suppored.');
                    }
                });

                return false;
            });

            // TODO: if drag/drop unsupported, regular file upload box - also needed for flash fallback of FileReader

            // create directory
            $('a.create-directory').on('click', function() {
                var name = prompt('New folder name:'), file;

                if (!name.match(/^[\w\d_\-\.]+$/)) {
                    alert('Name contains non-standard characters, aborting.');

                    return false;
                }
                else if (name.match(/^\.\.?$/)) {
                    alert('Cannot use a reserved name for your directory.');

                    return false;
                }

                if (file = checkFile(name)) {
                    if (file.directory) {
                        alert('Directory "' + file.name + '" already exists.');
                    }
                    else {
                        alert('A file called "' + file.name + '" exists, unable to create folder.');
                    }

                    return false;
                }

                var file = {
                    'directory': true,
                    'name': name,
                    'title': name + '/',
                    'path': WebDAV.path(),
                    'modified': Date.now(),
                    'size': false,
                    'type': getType(name),
                    'request': null,
                    'item': null,
                    'data': null,
                    'delete': true
                };

                file.request = request('MKCOL', file.path + file.name);

                file.request.addEventListener('loadstart', function(event) {
                    file.item.addClass('loading');
                }, false);

                file.request.addEventListener('load', function(event) {
                    file.item.removeClass('loading');
                }, false);

                file.request.addEventListener('error', function(event) {
                    delete files[file.index];

                    sortFiles();

                    renderFiles();

                    console.log('Error'); // TODO
                }, false);

                file.request.addEventListener('abort', function(event) {
                    delete files[file.index];

                    sortFiles();

                    renderFiles();

                    console.log('Aborted'); // TODO
                }, false);

                createListItem(file);

                files.push(file);

                sortFiles();

                renderFiles();

                file.request.send(null);

                return false;
            });
        },
        upload: function(file) {
            if (!file.name) {
                return false;;
            }

            file = $.extend({
                'directory': false,
                'title': file.name,
                'path': this.path(),
                'modified': new Date(),
                'size': file.data.length,
                'request': null,
                'item': null,
                'delete': true
            }, file);

            file.request = request('PUT', file.path + file.name);
            file.request.setRequestHeader('Content-Type', file.type);

            file.request.addEventListener('loadstart', function(event) {
                file.item.addClass('loading');
                file.item.find('span.size').after('<span class="uploading"><span class="progress"><span class="meter"></span></span><span class="cancel-upload">&times;</span></span>');
                file.item.find('span.cancel-upload').on('click', function() {
                    file.request.abort();

                    return false;
                });
            }, false);

            file.request.addEventListener('progress', function(event) {
                file.item.find('span.meter').width('' + ((event.position / event.total) * 100) + '%')
            }, false);

            file.request.addEventListener('load', function(event) {
                file.item.removeClass('loading');
                file.item.find('span.uploading').fadeOut(function() {
                    $(this).remove();
                });
                file.type = getType(file.name);
            }, false);

            file.request.addEventListener('error', function(event) {
                delete files[file.index];

                sortFiles();

                renderFiles();

                console.log('Error'); // TODO
            }, false);

            file.request.addEventListener('abort', function(event) {
                delete files[file.index];

                sortFiles();

                renderFiles();

                console.log('Aborted'); // TODO
            }, false);

            createListItem(file);

            files.push(file);

            sortFiles();

            renderFiles();

            file.request.sendAsBinary(file.data);

            return true;
        },
        del: function(file) {
            if (!file.name) {
                return false;
            }

            if (!('path' in file)) {
                file.path = this.path();
            }

            file.request = request('DELETE', file.path + file.name);

            file.request.addEventListener('load', function(event) {
                delete files[file.index];

                sortFiles();

                renderFiles();
            }, false);

            file.request.addEventListener('error', function(event) {
                console.log('Error'); // TODO
            }, false);

            file.request.addEventListener('abort', function(event) {
                console.log('Aborted'); // TODO
            }, false);

            file.request.send(null);

            return true;
        },
        path: function() {
            return path;
        }
    }
})();

$(function() {
    WebDAV.init();
});
