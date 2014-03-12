/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2013 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

function cockpit_quote_cmdline (cmds) {
    function quote(arg) {
        return arg.replace(/\\/g, '\\\\').replace(/ /g, '\\ ');
    }
    return cmds.map(quote).join(' ');
}

function cockpit_unquote_cmdline (string) {
    function shift(str) {
        return string.replace(/\\ /g, '\u0001').replace(/\\\\/g, '\u0002');
    }
    function unshift(str) {
        return str.replace(/\u0001/g, ' ').replace(/\u0002/g, '\\');
    }

    return shift(string).split(' ').map(unshift);
}

PageContainers.prototype = {
    _init: function() {
        this.id = "containers";
    },

    getTitle: function() {
        return C_("page-title", "Containers");
    },

    enter: function(first_visit) {
        if (first_visit) {
            this.client = new DockerClient();
            $(this.client).on('event', $.proxy (this, "update"));

            this.container_filter_btn =
                cockpit_select_btn($.proxy(this, "update"),
                                   [ { title: _("All"),                 choice: 'all',  is_default: true },
                                     { title: _("Running"),             choice: 'running' },
                                     { title: _("10 Recently Created"), choice: 'recent10' }
                                   ]);
            $('#containers-containers .panel-heading span').append(this.container_filter_btn);
        }
        this.update();
    },

    show: function() {
    },

    leave: function() {
    },

    update: function() {
        var me = this;

        var filter = cockpit_select_btn_selected(this.container_filter_btn);

        // Updating happens asynchronously, as we receive responses
        // from Docker.  However, a event might come in that triggers
        // a new update before the last one has finished.  To prevent
        // these two concurrent updates from interfering with each
        // other when they manipulate the DOM, we give each
        // asynchronous call a fresh and unique DOM element to
        // populate when the results come in.  If this update as been
        // overtaken by a concurrent update that DOM element will
        // never appear in the document.
        //
        // A better solution would be to maintain a Docker Object
        // Model that can be consulted synchronously and sends
        // asynchronous change notifications.

        function multi_line(strings) {
            return strings.map(cockpit_esc).join('<br/>');

        }

        function render_container(container) {

            function action (op) {
                if (op == 'start')
                    me.start_container(container.Id);
                else if (op == 'stop')
                    me.stop_container(container.Id);
                else if (op == 'remove')
                    me.remove_container(container.Id);
            }

            var state_td = $('<td>');
            var action_btn = cockpit_action_btn (action,
                                                 [ { title: _("Start"), action: 'start' },
                                                   { title: _("Stop"), action: 'stop',
                                                     is_default: true },
                                                   { title: _("Remove"), action: 'remove',
                                                     danger: true }
                                                 ]);
            var tr =
                $('<tr>').append(
                    $('<td>').html(multi_line(container.Names)),
                    $('<td>').text(container.Image),
                    $('<td>').text(container.Command),
                    state_td,
                    $('<td style="text-align:right">').html(action_btn));

            tr.on('click', function (event) {
                // XXX - dropdown toggles don't seem to eat their events
                if (!$(event.target).is('button'))
                    cockpit_go_down ({ page: 'container-details',
                                       id: container.Id
                                     });
            });

            me.client.get("/containers/" + container.Id + "/json",
                          function (error, info) {
                              var state = info.State;
                              if (state.Running) {
                                  cockpit_action_btn_select(action_btn, 'stop');
                                  state_td.text(F(_("Up since %{StartedAt}"), state));
                              } else {
                                  cockpit_action_btn_select(action_btn, 'start');
                                  state_td.text(F(_("Exited %{ExitCode}"), state));
                              }
                          });

            return tr;
        }

        function render_image(image) {

            function action (op) {
                if (op == 'run')
                    me.run_image(image.Id);
                else if (op == 'remove')
                    me.remove_image(image.Id);
            }

            var action_btn = cockpit_action_btn (action,
                                                 [ { title: _("Run"), action: 'run',
                                                     is_default: true },
                                                   { title: _("Remove"), action: 'remove',
                                                     danger: true }
                                                 ]);

            var tr =
                $('<tr>').append(
                    $('<td>').html(multi_line(image.RepoTags)),
                    $('<td>').text(new Date(image.Created*1000).toLocaleString()),
                    $('<td>').text(cockpit_format_bytes_pow2 (image.VirtualSize)),
                    $('<td style="text-align:right">').html(action_btn));

            tr.on('click', function (event) {
                // XXX - dropdown toggles don't seem to eat their events
                if (!$(event.target).is('button'))
                    cockpit_go_down ({ page: 'image-details',
                                       id: image.Id
                                     });
            });

            return tr;
        }

        var container_table = $('<table class="table">');
        $('#containers-containers table').replaceWith(container_table);

        var containers_resource = '/containers/json';
        if (filter == 'all')
            containers_resource += '?all=1';
        else if (filter == 'recent10')
            containers_resource += '?limit=10';

        this.client.get(containers_resource, function (error, containers) {
            if (error) {
                container_table.append(
                    $('<tr>').append(
                        $('<td>').text(F("Can't get %{resource}: %{error}",
                                         { resource: containers_resource, error: error }))));
                return;
            }

            container_table.append(
                $('<tr>', { 'style': 'font-weight:bold' }).append(
                    $('<td>').text(_("Name")),
                    $('<td>').text(_("Image")),
                    $('<td>').text(_("Command")),
                    $('<td>').text(_("Status")),
                    $('<td>')),
                containers.map(render_container));
        });

        var images_table = $('<table class="table">');
        $('#containers-images table').replaceWith(images_table);

        this.client.get('/images/json', function (error, images) {
            if (error) {
                images_table.append(
                    $('<tr>').append(
                        $('<td>').text(F("Can't get %{resource}: %{error}",
                                         { resource: '/images/json', error: error }))));
                return;
            }

            images_table.append(
                $('<tr>', { 'style': 'font-weight:bold' }).append(
                    $('<td>').text(_("Tags")),
                    $('<td>').text(_("Created")),
                    $('<td>').text(_("Virtual Size")),
                    $('<td>')),
                images.map(render_image));
        });
    },

    start_container: function (id) {
        this.client.post("/containers/" + id + "/start", null, function (error, result) {
            if (error)
                cockpit_show_unexpected_error (error);
        });
    },

    stop_container: function (id) {
        this.client.post("/containers/" + id + "/stop", null, function (error, result) {
            if (error)
                cockpit_show_unexpected_error (error);
        });
    },

    remove_container: function (id) {
        this.client.delete_("/containers/" + id, function (error, result) {
            if (error)
                cockpit_show_unexpected_error (error);
        });
    },

    run_image: function (id) {
        var me = this;
        this.client.get("/images/" + id + "/json", function (error, info) {
            if (error) {
                cockpit_show_unexpected_error (error);
            } else {
                PageRunImage.image_info = info;
                PageRunImage.client = me.client;
                $("#containers_run_image_dialog").modal('show');
            }
        });
    },

    remove_image: function (id) {
        this.client.delete_("/images/" + id, function (error, result) {
            if (error)
                cockpit_show_unexpected_error (error);
        });
    }
};

function PageContainers() {
    this._init();
}

cockpit_pages.push(new PageContainers());

PageRunImage.prototype = {
    _init: function() {
        this.id = "containers_run_image_dialog";
    },

    getTitle: function() {
        return C_("page-title", "Run Image");
    },

    show: function() {
    },

    leave: function() {
    },

    enter: function(first_visit) {
        if (first_visit) {
            $("#containers-run-image-run").on('click', $.proxy(this, "run"));
        }

        // from https://github.com/dotcloud/docker/blob/master/pkg/namesgenerator/names-generator.go

        var left = [ "happy", "jolly", "dreamy", "sad", "angry", "pensive", "focused", "sleepy", "grave", "distracted", "determined", "stoic", "stupefied", "sharp", "agitated", "cocky", "tender", "goofy", "furious", "desperate", "hopeful", "compassionate", "silly", "lonely", "condescending", "naughty", "kickass", "drunk", "boring", "nostalgic", "ecstatic", "insane", "cranky", "mad", "jovial", "sick", "hungry", "thirsty", "elegant", "backstabbing", "clever", "trusting", "loving", "suspicious", "berserk", "high", "romantic", "prickly", "evil" ];

        var right = [ "lovelace", "franklin", "tesla", "einstein", "bohr", "davinci", "pasteur", "nobel", "curie", "darwin", "turing", "ritchie", "torvalds", "pike", "thompson", "wozniak", "galileo", "euclid", "newton", "fermat", "archimedes", "poincare", "heisenberg", "feynman", "hawking", "fermi", "pare", "mccarthy", "engelbart", "babbage", "albattani", "ptolemy", "bell", "wright", "lumiere", "morse", "mclean", "brown", "bardeen", "brattain", "shockley" ];

        function make_name() {
            function ranchoice(array) {
                return array[Math.round(Math.random() * (array.length-1))];
            }
            return ranchoice(left) + "_" + ranchoice(right);
        }

        $("#containers-run-image-name").val(make_name());
        $("#containers-run-image-command").val(cockpit_quote_cmdline(PageRunImage.image_info.config.Cmd));

        function render_port(p) {
            var port_input = $('<input class="form-control" style="display:inline;width:auto" >');

            function selected(choice) {
                port_input.toggle(choice == 'specified');
            }

            var li =
                $('<li class="list-group-item">').append(
                    $('<span>').text(p),
                    $('<span>').text(_(" bound to ")),
                    cockpit_select_btn(selected,
                                       [ { 'title': _("nothing"), choice: 'nothing', is_default: true },
                                         { 'title': _("random host port"), choice: 'random' },
                                         { 'title': _("speficied host port"), choice: 'specified' }
                                       ]).css('display', 'inline'),
                    port_input);
            port_input.hide();
            return li;
        }

        var ports = $('#containers-run-ports');
        ports.empty();
        var list = $('<ul class="list-group">');
        for (var p in PageRunImage.image_info.config.ExposedPorts) {
            list.append(render_port(p));
        }
        ports.append(list);
    },

    run: function() {
        var name = $("#containers-run-image-name").val();
        var cmd = $("#containers-run-image-command").val();

        $("#containers_run_image_dialog").modal('hide');

        PageRunImage.client.post("/containers/create?name=" + encodeURIComponent(name),
                                 { "Cmd": cockpit_unquote_cmdline(cmd),
                                   "Image": PageRunImage.image_info.id
                                 },
                                 function (error, result) {
                                     if (error)
                                         cockpit_show_unexpected_error (error);
                                     else {
                                         PageRunImage.client.post("/containers/" + result.Id + "/start", { },
                                                                  function (error) {
                                                                      if (error)
                                                                          cockpit_show_unexpected_error (error);
                                                                  });
                                     }
                                 });
    }
};

function PageRunImage() {
    this._init();
}

cockpit_pages.push(new PageRunImage());

PageContainerDetails.prototype = {
    _init: function() {
        this.id = "container-details";
    },

    getTitle: function() {
        var id = this.container_id;
        return F(C_("page-title", "Container %{id}"), { id: id? id.slice(0,12) : "<??>" });
    },

    show: function() {
    },

    leave: function() {
    },

    enter: function(first_visit) {
        this.container_id = cockpit_get_page_param('id');
    }

};

function PageContainerDetails() {
    this._init();
}

cockpit_pages.push(new PageContainerDetails());

PageImageDetails.prototype = {
    _init: function() {
        this.id = "image-details";
    },

    getTitle: function() {
        var id = this.image_id;
        return F(C_("page-title", "Image %{id}"), { id: id? id.slice(0,12) : "<??>" });
    },

    show: function() {
    },

    leave: function() {
    },

    enter: function(first_visit) {
        this.image_id = cockpit_get_page_param('id');
    }

};

function PageImageDetails() {
    this._init();
}

cockpit_pages.push(new PageImageDetails());


/* MOCK DOCKER RESPONDER
*/

function DockerClient() {
    var me = this;

    var containers =
         [ {"Command":"node /src/index.js",
            "Created":1394455735,
            "Id":"7a7e76e00fa6563b0c0b70a1e2e3b11146afa11c49aacb34d06c225db1bb812d",
            "Image":"mvollmer/nodejs:latest",
            "Names":["/nodejs"],
            "Ports":[{"IP":"0.0.0.0","PrivatePort":8080,"PublicPort":8080,"Type":"tcp"}]
           }
         ];

    var images =
        [ {"Created":1394445579,
           "Id":"d5cf505c5b998e577950816c6cb7776a5abc01ff09a846b1c4c42e86dc978d96",
           "ParentId":"e8b2b9353e7046a91ac38a3246e9061cb36aeb4b15a780dbf2ec810e1ee5f4c8",
           "RepoTags":["mvollmer/nodejs:latest"],
           "Size":0,
           "VirtualSize":1096326874
          },
          {"Created":1394104925,
           "Id":"0c295b6f613e58e6a09e6ac6e37503cbfa04bd2f0c1a83dce9315718feba26a2",
           "ParentId":"779c7e14a46617a70a46ef78ac342a3fee8d0fd874b1bfdc32b72465705d115e",
           "RepoTags":["tutum/wordpress:latest"],
           "Size":0,
           "VirtualSize":620110708},
          {"Created":1394104237,
           "Id":"34ead373df921d5d28226e7a6795280f4f33bbfdf7ca0bc9c98a3e431a8f2e44",
           "ParentId":"550aa8256008af492f131b473364afb4e16999903b56311ddb23df7bc13635e2",
           "RepoTags":["tutum/lamp:latest"],
           "Size":0,
           "VirtualSize":484333730},
          {"Created":1391444049,
           "Id":"0d20aec6529d5d396b195182c0eaa82bfe014c3e82ab390203ed56a774d2c404",
           "ParentId":"8abc22fbb04266308ff408ca61cb8f6f4244a59308f7efc64e54b08b496c58db",
           "RepoTags":["fedora:rawhide"],
           "Size":387016823,
           "VirtualSize":387016823},
          {"Created":1391443840,
           "Id":"58394af373423902a1b97f209a31e3777932d9321ef10e64feaaa7b4df609cf9",
           "ParentId":"8abc22fbb04266308ff408ca61cb8f6f4244a59308f7efc64e54b08b496c58db",
           "RepoTags":["fedora:20","fedora:heisenbug","fedora:latest"],
           "Size":385520098,"VirtualSize":385520098
          }
        ];

    var container_state = { };
    var image_config = { };

    containers.forEach(function (c) {
        container_state[c.Id] = { "Running":true,
                                  "Pid":12800,
                                  "ExitCode":0,
                                  "StartedAt":"2014-03-10T12:50:33.214661528Z",
                                  "FinishedAt":"2014-03-10T12:50:23.128194694Z",
                                  "Ghost":false
                                };
    });

    image_config["d5cf505c5b998e577950816c6cb7776a5abc01ff09a846b1c4c42e86dc978d96"] =
        { "Cmd": [ "node", "/src/index.js" ],
          "ExposedPorts": { "8080/tcp": {} }
        };

    image_config["0c295b6f613e58e6a09e6ac6e37503cbfa04bd2f0c1a83dce9315718feba26a2"] =
        { "Cmd": [ "/start.sh" ],
          "ExposedPorts": { "80/tcp": {},
                            "22/tcp": {}
                          }
        };

    images.forEach(function(img) {
        if (!image_config[img.Id]) {
            image_config[img.Id] = { "Cmd": [ "default", "bla", "bla" ],
                                     "ExposedPorts": { }
                                   };
        }
    });

    function make_id() {
        return Math.floor(Math.random() * 65535).toString(16) + "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    }

    function find_image(id) {
        return images.find(function (img) { return img.Id == id; });
    }

    function is_running(id) {
        return container_state[id] && container_state[id].Running;
    }

    function get (resource, cont) {
        var match, id, state;
        if (resource == "/containers/json") {
            cont (null, containers.filter(function (c) { return is_running(c.Id); }));
        } else if (resource == "/containers/json?all=1") {
            cont (null, containers);
        } else if ((match = resource.match("^/containers/json\\?limit=(.*)$"))) {
            // cough
            cont (null, containers);
        } else if (resource == "/images/json") {
            cont (null, images);
        } else if ((match = resource.match("^/containers/(.*)/json$"))) {
            id = match[1];
            cont (null, { "ID": id,
                          "State": container_state[id]
                        });
        } else if ((match = resource.match("^/images/(.*)/json$"))) {
            id = match[1];
            cont (null, { "id": id,
                          "config": image_config[id]
                        });
        } else
            cont ("Unrecognized");
    }

    function post (resource, data, cont) {
        var match, id, name, img, c;

        if ((match = resource.match("^/containers/(.*)/start$"))) {
            id = match[1];
            if (container_state[id].Running) {
                cont (F("start: Cannot start container %{id}: The container %{id} is already running.",
                        { id: id }));
            } else {
                container_state[id].Running = true;
                container_state[id].StartedAt = "XXX";
                $(me).trigger('event', { 'status': 'start', 'id': id });
                cont (null);
            }
        } else if ((match = resource.match("^/containers/(.*)/stop$"))) {
            id = match[1];
            if (container_state[id].Running) {
                $(me).trigger('event', { 'status': 'die', 'id': id });
                setTimeout(function () {
                    container_state[id].Running = false;
                    container_state[id].FinishedAt = "XXX";
                    container_state[id].ExitCode = 123;
                    $(me).trigger('event', { 'status': 'stop', 'id': id });
                }, 500);
            }
            cont (null);
        } else if ((match = resource.match("^/containers/create\\?name=(.*)$"))) {
            id = make_id();
            name = match[1];
            img = find_image (data.Image);
            c = { "Command": cockpit_quote_cmdline(data.Cmd),
                  "Created":1394455735,
                  "Id":id,
                  "Image": img.RepoTags[0],
                  "Names": [ name ]
                };
            containers.push(c);
            container_state[id] = { "Running": false,
                                    "ExitCode": 0
                                  };
            $(me).trigger('event', { 'status': 'create', 'id': id });
            cont (null, { "Id": id });
        } else {
            cont ("Unrecognized");
        }
    }

    function delete_ (resource, cont) {
        var match, id;

        if ((match = resource.match("^/containers/(.*)$"))) {
            id = match[1];
            if (!container_state[id])
                cont(F("container_delete: No such container: %{id}", { id: id }));
            else if (container_state[id].Running)
                cont(F("container_delete: Impossible to remove a running container, please stop it first"));
            else {
                setTimeout(function () {
                    delete container_state[id];
                    containers = containers.filter(function (c) { return c.Id != id; });
                    $(me).trigger('event', { 'status': 'destroy', 'id': id });
                }, 1000);
                cont(null);
            }
        } else if ((match = resource.match("^/images/(.*)$"))) {
            id = match[1];
            if (!image_config[id]) {
                cont (F("image_delete: No such image: %{id}", { id: id }));
            } else {
                $(me).trigger('event', { 'status': 'untag', 'id': id });
                setTimeout(function () {
                    delete image_config[id];
                    images = images.filter(function (img) { return img.Id != id; });
                    $(me).trigger('event', { 'status': 'delete', 'id': id });
                }, 400);
                cont(null);
            }
        } else
            cont ("Unrecognized");

    }

    this.get = get;
    this.post = post;
    this.delete_ = delete_;
}
