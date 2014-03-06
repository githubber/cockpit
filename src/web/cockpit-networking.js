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

PageNetworking.prototype = {
    _init: function () {
        this.id = "networking";
    },

    getTitle: function() {
        return C_("page-title", "Networking");
    },

    enter: function (first_visit) {
        $(cockpit_dbus_client).on("objectAdded.networking", $.proxy(this, "on_change"));
        $(cockpit_dbus_client).on("objectRemoved.networking", $.proxy(this, "on_change"));
        $(cockpit_dbus_client).on("propertiesChanged.networking", $.proxy(this, "on_change"));
        this.update();
    },

    show: function() {
    },

    leave: function() {
        $(cockpit_dbus_client).off("objectAdded.networking");
        $(cockpit_dbus_client).off("objectRemoved.networking");
        $(cockpit_dbus_client).off("propertiesChanged.networking");
    },

    on_change: function(event, obj, iface) {
        if (obj.objectPath.indexOf("/com/redhat/Cockpit/Network/") !== 0)
            return;
        this.update();
    },

    update: function() {
        var i, iface;
        var ifaces = cockpit_dbus_client.getInterfacesFrom("/com/redhat/Cockpit/Network/",
                                                           "com.redhat.Cockpit.Network.Netinterface");

        var list = $('#networking_content');

        function toDec(n) {
            return n.toString(10);
        }

        function toHex(n) {
            var x = n.toString(16);
            while (x.length < 2)
                x = '0' + x;
            return x;
        }

        function render_ip4_address(addr) {
            var num = addr.slice(0,-1);
            var mask = addr[addr.length-1];
            return $('<span>').text(num.map(toDec).join('.') + '/' + toDec(mask));
        }

        function render_ip6_address(addr) {
            var num = addr.slice(0,-1);
            var mask = addr[addr.length-1];
            return $('<span>').text(num.map(toHex).join(':') + '/' + toDec(mask));
        }

        list.empty();
        for (i = 0; i < ifaces.length; i++) {
            iface = ifaces[i];

            if (!iface.HwAddress)
                continue;

            list.append(
                $('<li class="list-group-item">').append(
                    $('<div>').text(iface.Name),
                    $('<table class="cockpit-info-table">').append(
                        $('<tr>').append(
                            $('<td>').text(_("Hardware Address")),
                            $('<td>').text(iface.HwAddress)),
                        iface.IP4Addresses.map(function (a) {
                            return $('<tr>').append($('<td>').text(_("IP4 Address")),
                                                    $('<td>').html(render_ip4_address(a)));
                        }),
                        iface.IP6Addresses.map(function (a) {
                            return $('<tr>').append($('<td>').text(_("IP6 Address")),
                                                    $('<td>').html(render_ip6_address(a)));
                        }))));
        }
    }

};

function PageNetworking() {
    this._init();
}

cockpit_pages.push(new PageNetworking());
