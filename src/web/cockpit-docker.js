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
        }
        this.update();
    },

    show: function() {
    },

    leave: function() {
    },

    update: function() {
        var me = this;

        // Updating happens asynchronously, as we receive responses
        // from Docker.  However, a event might come in that triggers
        // a new update before the last one has finished.  To prevent
        // these two concurrent updates from interfering with each
        // other when they manipulate the DOM, we give each
        // asynchronous call a fresh and unique DOM element to
        // populate when the results come in.  If this update as been
        // overtaken by a concurrent update that DOM element will
        // never appear in the document.

        function make_container_action (id) {
        }

        function make_image_action (id) {
        }

        function multi_line(strings) {
            return strings.map(cockpit_esc).join('<br/>');

        }

        function render_container(container) {

            function action (op) {
                if (op == 'start')
                    me.start_container(container.id);
                else if (op == 'stop')
                    me.stop_container(container.id);
                else if (op == 'remove')
                    me.remove_container(container.id);
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
                    $('<td>').text(container.Id.slice(0,12)),
                    $('<td>').html(multi_line(container.Names)),
                    $('<td>').text(container.Image),
                    $('<td>').text(container.Command),
                    state_td,
                    $('<td>').html(action_btn));

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
                    me.run_image(image.id);
                else if (op == 'remove')
                    me.remove_image(image.id);
            }

            var action_btn = cockpit_action_btn (action,
                                                 [ { title: _("Run"), action: 'run',
                                                     is_default: true },
                                                   { title: _("Remove"), action: 'remove',
                                                     danger: true }
                                                 ]);

            var tr = 
                $('<tr>').append(
                    $('<td>').text(image.Id.slice(0,12)),
                    $('<td>').html(multi_line(image.RepoTags)),
                    $('<td>').text(new Date(image.Created*1000).toLocaleString()),
                    $('<td>').text(cockpit_format_bytes_pow2 (image.VirtualSize)),
                    $('<td>').html(action_btn));
            return tr;
        }

        var container_table = $('<table class="table">');
        $('#containers-containers table').replaceWith(container_table);

        this.client.get('/containers/json', function (error, containers) {
            container_table.append(
                $('<tr>', { 'style': 'font-weight:bold' }).append(
                    $('<td>').text(_("Id")),
                    $('<td>').text(_("Names")),
                    $('<td>').text(_("Image")),
                    $('<td>').text(_("Command")),
                    $('<td>').text(_("Status")),
                    $('<td>')),
                containers.map(render_container));
        });

        var images_table = $('<table class="table">');
        $('#containers-images table').replaceWith(images_table);

        this.client.get('/images/json', function (error, images) {
            images_table.append(
                $('<tr>', { 'style': 'font-weight:bold' }).append(
                    $('<td>').text(_("Id")),
                    $('<td>').text(_("Tags")),
                    $('<td>').text(_("Created")),
                    $('<td>').text(_("Virtual Size")),
                    $('<td>')),
                images.map(render_image));
        });
    },
  
    start_container: function (id) {
    },

    stop_container: function (id) {
    },

    remove_container: function (id) {
    },

    run_image: function (id) {
    },

    remove_image: function (id) {
    }
};

function PageContainers() {
    this._init();
}

cockpit_pages.push(new PageContainers());

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
            "Ports":[{"IP":"0.0.0.0","PrivatePort":8080,"PublicPort":8080,"Type":"tcp"}],
            "Status":"Up 2 hours"
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

    function get (resource, cont) {
        var match;
        if (resource == "/containers/json") {
            cont (null, containers);
        } else if (resource == "/images/json") {
            cont (null, images);
        } else if ((match = resource.match("^/containers/(.*)/json$"))) {
            cont (null, { "ID": match[1],
                          "State": { "Running":true,
                                     "Pid":12800,
                                     "ExitCode":0,
                                     "StartedAt":"2014-03-10T12:50:33.214661528Z",
                                     "FinishedAt":"2014-03-10T12:50:23.128194694Z",
                                     "Ghost":false
                                   }
                        });
        } else
            cont ("Unrecognized");
    }

    function put (resource, data) {
    }

    this.get = get;
    this.put = put;
}
