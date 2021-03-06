/*
 * Copyright (c) 2011 BE ISI iSPlugins Université Paul Sabatier.
 *
 * This file is part of iceScrum.
 *
 * Chat plugin is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 *
 * Chat plugin is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Chat plugin.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Authors:	Claude AUBRY (claude.aubry@gmail.com)
 *		Vincent Barrier (vbarrier@kagilum.com)
 *		Marc-Antoine BEAUVAIS (marcantoine.beauvais@gmail.com)
 *		Jihane KHALIL (khaliljihane@gmail.com)
 *		Paul LABONNE (paul.labonne@gmail.com)
 *		Nicolas NOULLET (nicolas.noullet@gmail.com)
 *		Bertrand PAGES (pages.bertrand@gmail.com)
 *
 *
 */

var flensed={base_path:''};

(function($) {
    $.icescrum.chat = {

        // Valeurs par défaut de la config du chat
        // Ces valeurs peuvent être mise à jour à l'execution
        // par l'appel du Tag loadChatJSContext à partir du fichier DefaultChatConfig
        defaults:{
            server : null,
            port : 7070,
            boshPath:null,
            connection : null,
            connected : false,
            width : 210,
            gap : 20,
            sendPresence:true,
            hideOffline:true,
            maxChats : 5,
            status : "#chat-status",
            chatList : new Array(),
            showList : new Array(),
            teamList : null,
            emoticonsDir : null,
            ownjid : null,
            currentStatus : {
                show:'online',
                presence:null
            },
            i18n:{
                me:'me',
                alertNewMessages:'new messages',
                customStatusError:'Error while trying to save your status',
                connectionError:'Error chat server is offline.',
                connecting:'Connecting...',
                loginError:'Connection to chat server failed, please check your login / password.',
                disconnected:'You are disconnected from chat server.',
                connected:'Your are connected on chat server.',
                teamNonIcescrum:'External contacts',
                yes:'Yes',
                no:'No',
                accept:'Accept:',
                requestSent:'Request sent to ',
                requestError:'Error invalid email address'
            }
        },

        o:{},

        // Initialisation de la connexion
        init:function(options) {
            if (typeof icescrumChat === undefined) { icescrumChat = options; }
            //Initialise l'object o avec les attributs/valeurs de default
            this.o = jQuery.extend({}, this.defaults, icescrumChat);
            this._nbMaxChat();
            $(window).bind('resize.chat', function (){
                $.icescrum.chat._nbMaxChat();
            }).trigger('resize');
            this.o.sendPresence = true;
            $.icescrum.emoticons.initialize(this.o.emoticonsDir);
            if ($.icescrum.chat.o.currentStatus.show != 'disc'){
                this._initConnect();
            }else{
                this._disconnected();
            }
        },

        reloadChat:function(){
            $("#widget-id-chat").data('id','chat');
            $.icescrum.closeWidget($("#widget-id-chat"),true);
            $.icescrum.addToWidgetBar('chat');
        },

        _initConnect:function(){
            $("#chatstatus-button").removeClass('ui-chat-status-away ui-chat-status-chat ui-chat-status-online ui-chat-status-xa ui-chat-status-dnd').addClass('ui-chat-select ui-chat-status-offline');
            $("#chatstatus-button .ui-selectmenu-status").text(this.o.i18n.connecting);
            console.log("[icescrum-chat] Connecting to server...");
            this.o.connection = new Strophe.Connection("http://"+this.o.server+":"+this.o.port+this.o.boshPath);
            if (this.o.connection == null){
                console.log("[icescrum-chat] Error not connected to server");
                $.icescrum.renderNotice(this.o.i18n.connectionError,'error');
            }

            console.log("[icescrum-chat] Login from iceScrum server");

            $.ajax({type:'POST',
                global:false,
                url: $.icescrum.o.grailsServer + '/chat/attachConnection',
                success:function(data) {
                    console.log("[icescrum-chat] Attaching connection");
                    $.icescrum.chat.o.connection.attach(data.jid, data.sid,parseInt(data.rid) + 1, $.icescrum.chat._connectionHandler);
                    $.icescrum.chat.o.ownjid = data.jid;
                },
                error:function() {
                    $.icescrum.renderNotice($.icescrum.chat.o.i18n.loginError,'error');
                    $.icescrum.chat._disconnected();
                    console.log("[icescrum-chat] Error connection not attached");
                }
            });
        },

        _nbMaxChat : function(){
            $.icescrum.chat.o.maxChats= Math.floor($(window).width()/($.icescrum.chat.o.width+$.icescrum.chat.o.gap ));
            if($.icescrum.chat.o.showList.length >= $.icescrum.chat.o.maxChats){
                for(var i = 0; i < ($.icescrum.chat.o.showList.length - $.icescrum.chat.o.maxChats); i ++){
                     var id = $.icescrum.chat.o.showList[0];
                     $.icescrum.chat.closeChat(id);
                }
            }
        },

        // Retourne le décalage absolu par rapport au bord droit
        // pour positionner la prochaine fenêtre
        _getNextOffset:function() {
            return (this.o.width + this.o.gap) * this.o.showList.length;
        },

        // Traitement du retour de la connexion
        _connectionHandler:function(status){
            if (status == Strophe.Status.CONNECTING) {
                $.icescrum.renderNotice($.icescrum.chat.o.i18n.connecting,'notice');
            } else if (status == Strophe.Status.CONNFAIL) {
                $.icescrum.chat._disconnected();
            } else if (status == Strophe.Status.DISCONNECTED) {
                $.icescrum.chat._disconnected();
            } else if (status == Strophe.Status.CONNECTED || status == Strophe.Status.ATTACHED) {
                $.icescrum.chat._connected();
            }
        },

        _disconnected:function(){
            $("#chatstatus").selectmenu("value",$("#chatstatus option:last").index());
            $('.ui-chat-status')
                    .removeClass('ui-chat-status-away ui-chat-status-xa ui-chat-status-dnd ui-chat-status-chat')
                    .addClass('ui-chat-status-offline');
            $.icescrum.chat.o.connected = false;
            $.icescrum.chat.displayRoster();
            $(window).trigger("disconnected");
            $('#chat-roster-list').html('');
            $('.nb-contacts').html('');
        },

        _connected:function(){
            this._retrieveRoster();
            $.icescrum.chat.o.connection.addHandler($.icescrum.chat._onPresenceChange, null, 'presence', null, null,  null);
            $.icescrum.chat.o.connection.addHandler($.icescrum.chat._onPresenceError, null, 'presence', 'error', null, null);
            $.icescrum.chat.o.connection.addHandler($.icescrum.chat._onReceiveMessage, null, 'message', null, null,  null);
            $.icescrum.chat.o.connection.addHandler($.icescrum.chat._onReceiveServiceDiscoveryGet, null, 'iq', 'get', null, null);
            $.icescrum.chat.o.connection.addHandler($.icescrum.chat._onSetChange, null, 'iq', 'set', null, null);
            $.icescrum.chat.o.connection.addTimedHandler(4000,$.icescrum.chat._onPeriodicPauseStateCheck);
            $.icescrum.chat.o.connected = true;

            if($.icescrum.chat.o.sendPresence){
                var found = false;
                if ($.icescrum.chat.o.currentStatus.show != null &&  $.icescrum.chat.o.currentStatus.presence != null){
                    $('#chatstatus .ui-chat-status-'+$.icescrum.chat.o.currentStatus.show).each(function(){
                        if($(this).text() == $.icescrum.chat.o.currentStatus.presence){
                            $("#chatstatus").selectmenu('value',$(this).index());
                            found = true;
                        }
                    });
                }
                if (found){
                    $.icescrum.chat.changeStatus($.icescrum.chat.o.currentStatus.presence,$.icescrum.chat.o.currentStatus.show,false);
                }else{
                    $("#chatstatus").selectmenu("value",$("#chatstatus option:first").index());
                    $.icescrum.chat.o.connection.send($pres().tree());
                }
                $("#chatstatus-button").removeClass('ui-chat-status-offline');
            }

            console.log("[icescrum-chat] Connected ready to chat");
            $.icescrum.chat._editableSelectList();
            $(window).trigger("connected");
        },

        // Traitement de la reception d'un message :
        // - ouverture de la fenêtre de chat
        // - ajout du message à la fenêtre
        // - prend en compte le changement d'état
        _onReceiveMessage:function(msg){
            var escapedJid = $.icescrum.chat.escapeJid(Strophe.getBareJidFromJid(msg.getAttribute('from')));
            var to = msg.getAttribute('to');
            var type = msg.getAttribute('type');
            var body = msg.getElementsByTagName('body');
            var chatId = 'chat-'+escapedJid;
            if (type == "chat") {
                if(body.length > 0) {
                    $.icescrum.chat.createOrOpenChat(chatId,escapedJid,false);
                    $.icescrum.chat._onChatMessage(escapedJid,body);
                }
                if($.icescrum.chat.o.chatList.indexOf(chatId) != -1) {
                    $.icescrum.chat.manageStateReception(msg, escapedJid);
                }
            }
            return true;
        },

        // Ajoute le message à la fenêtre de chat
        _onChatMessage:function(escapedJid,text){
            var rawJid = $.icescrum.chat.unescapeJid(escapedJid);
            console.log("[icescrum-chat] Message received from "+rawJid);
            var extractedText = (text[0].text) ? text[0].text : (text[0].textContent) ? text[0].textContent : "";
            var name = $('#chat-user-status-'+escapedJid+' a').attr('firstname') ? $('#chat-user-status-'+escapedJid+' a').attr('firstname') : rawJid;
            name = $.icescrum.chat.truncate(name,15);
            extractedText = $('<pre>').text(extractedText).html();
            extractedText = $.icescrum.chat.displayBacklogElementUrl(extractedText,'story');
            $("#chat-" + escapedJid).chat("option", "chatManager").addMsg(name, extractedText[1]);
        },

        // Permet de d'être informé lors d'un changement de statut
        _onPresenceChange:function(presence){
            var type = $(presence).attr('type');
            var show = $(presence).find('show').text();
            var status = $(presence).find('status').text();
            var rawJid = $(presence).attr('from');
            var escapedJid = $.icescrum.chat.escapeJid(Strophe.getBareJidFromJid(rawJid));

            if(type == null)
            {
                $.icescrum.chat.changeImageStatus(escapedJid, status, show, type);
                console.log("[icescrum-chat] Presence received from "+ $.icescrum.chat.unescapeJid(escapedJid) + " show: " + show + " status:" + status);
            }
            else if(type == 'subscribe'){
                 console.log("[icescrum-chat] Receive presence subscription from "+ escapedJid);
                if (!$('#chat-user-status-' + escapedJid).length > 0){
                    $.icescrum.chat.confirmSubscription(escapedJid);
                    console.log("[icescrum-chat] need confirmation for "+ escapedJid);
                }else{
                    var responseMessage = $pres({type: 'subscribed', to: $(presence).attr('from')});
                    $.icescrum.chat.o.connection.send(responseMessage.tree());
                    console.log("[icescrum-chat] subscribed back for "+ escapedJid);
                }
            }
            else if(type == 'subscribed'){
                console.log("[icescrum-chat] Receiving subscription acceptation from "+ rawJid);
            }
            else if(type == 'unavailable' || type == 'unsubscribed'){
                console.log("[icescrum-chat] Receive presence unsubscription from "+ escapedJid);
                $.icescrum.chat.changeImageStatus(escapedJid, '', show, type);
            }
            $.icescrum.chat.finalizeContactList();
            return true;
        },

        _onPresenceError:function(presence){
            var escapedJid = $.icescrum.chat.escapeJid(Strophe.getBareJidFromJid($(presence).attr('from')));
            console.log("[icescrum-chat] Presence error from "+ $.icescrum.chat.unescapeJid(escapedJid));
            return true;
        },

        // Traite la reception d'un stanza de demande de découverte de services
        // en indiquant le support du service chat states
        _onReceiveServiceDiscoveryGet:function(iq){
            var to = iq.getAttribute('from');
            var query = iq.getElementsByTagName('query')[0].namespaceURI;
            if(query == 'http://jabber.org/protocol/disco#info') {
                var serviceDiscoveryResult = $iq({type:'result', to: to})
                                            .c('query', {xmlns:'http://jabber.org/protocol/disco#info'})
                                            .c('feature', {'var':'http://jabber.org/protocol/chatstates'});
                console.log("[icescrum-chat] Receiving service discovery get, result: \n" + serviceDiscoveryResult.toString());
                $.icescrum.chat.o.connection.send(serviceDiscoveryResult.tree());
                return true;
            }
        },

        _onPeriodicPauseStateCheck:function(){
            var chatKey;
            for(chatKey in $.icescrum.chat.o.chatList){
                var chatId = $.icescrum.chat.o.chatList[chatKey];
                var isComposing = $("#"+chatId).chat("option","isComposing");
                if(isComposing){
                    var hasChanged = $("#"+chatId).chat("option","hasChanged");
                    if(hasChanged){
                        $("#"+chatId).chat("option","hasChanged", false);
                    }
                    else{
                        var escapedJid = chatId.split("-")[1];
                        $.icescrum.chat.sendState(escapedJid,"paused");
                        $("#"+chatId).chat("option","isComposing", false);
                    }
                }
            }
            return true;
        },


        _retrieveRoster:function() {
            var iq = $iq({type: 'get'}).c('query', {'xmlns':Strophe.NS.ROSTER});
	        console.log("[icescrum-chat] Requesting roster");
	        $.icescrum.chat.o.connection.sendIQ(iq, this._onRosterReceived);
        },

        _onSetChange:function(iq){
            var query = iq.getElementsByTagName('query')[0].namespaceURI;
            if (query == Strophe.NS.ROSTER){
                var jabberList = [];
                $(iq).find("item").each(function(){
                    var subscription = $(this).attr('subscription');
                    var jid = $(this).attr('jid');
                    if (subscription != 'remove'){
                        if ($('#chat-user-status-'+ $.icescrum.chat.escapeJid(jid)).length == 0){
                            jabberList.push({rawJid:jid, name:$(this).attr('name')});
                        }
                    }
                    if (subscription == 'remove'){
                        $('#chat-user-status-'+ $.icescrum.chat.escapeJid(jid)).remove();
                        $.icescrum.chat.finalizeContactList();
                    }
                    console.log("[icescrum-chat] updating roster subscription:"+subscription);
                });
                if (jabberList.length > 0){
                    $.icescrum.chat.mergeContactLists(jabberList,true);
                }
            }
            return true;
        },

        _onRosterReceived:function(iq) {
            console.log("[icescrum-chat] Receiving roster");
            var jabberList = [];
            $(iq).find("item").each(function() {
                if($(this).attr('ask') == 'subscribe'){
                    jabberList.push({rawJid:$(this).attr('jid'), name:$(this).attr('name')});
                    return;
                }
                else if($(this).attr('ask')) {
                        return true;
                }
                jabberList.push({rawJid:$(this).attr('jid'), name:$(this).attr('name')});
            });
            $.icescrum.chat.mergeContactLists(jabberList,true);
        },

        answerPresenceSubscription:function(escapedJid, answer){
            //Send response
            var responseMessage = $pres({type: answer, to: $.icescrum.chat.unescapeJid(escapedJid)});
            $.icescrum.chat.o.connection.send(responseMessage.tree());
            console.log("[icescrum-chat] Subscription confirm answer : "+answer+" to "+escapedJid);

            //request subscription back
            if (answer == 'subscribed'){
                var subscriptionMessage = $pres({type: 'subscribe', to: $.icescrum.chat.unescapeJid(escapedJid)});
                $.icescrum.chat.o.connection.send(subscriptionMessage.tree());
                console.log("[icescrum-chat] Subscription sent back to "+escapedJid);
            }
            $('#subscription-' + escapedJid).remove();
        },

        requestSubscriptionContact:function() {
            var rawJid = $('#chat-add-contact').val();
            if (rawJid.indexOf('@') == -1){
                rawJid = rawJid+'@'+$.icescrum.chat.o.server;
                $('#chat-add-contact').val(rawJid);
            }
            var escapedJid = $.icescrum.chat.escapeJid(rawJid);
            if(Strophe.getBareJidFromJid($.icescrum.chat.o.ownjid) == escapedJid){
                $('#chat-add-contact').val("");
            }
            else if ($.icescrum.isValidEmail(rawJid) && $('#chat-user-status-' + escapedJid).length == 0){
                var subscriptionMessage = $pres({type: 'subscribe', to: rawJid});
                $.icescrum.chat.o.connection.send(subscriptionMessage.tree());
                $('#chat-add-contact').val("");
                $.icescrum.renderNotice($.icescrum.chat.o.i18n.requestSent+rawJid);
            }else if($('#chat-user-status-' + escapedJid).length > 0){
                $('#chat-add-contact').val("");
            }else{
                $.icescrum.renderNotice($.icescrum.chat.o.i18n.requestError,'error');
            }
        },

        confirmSubscription:function(escapedJid) {
            if ($('#subscription-'+escapedJid).length > 0){
                return;
            }
            $('#chat-manage').before('<div class="subscription" id="subscription-'+escapedJid+'">' +
                    $.icescrum.chat.o.i18n.accept+' '+$.icescrum.chat.truncate($.icescrum.chat.unescapeJid(escapedJid), 35)+' ?' +
                    '<button onclick="$.icescrum.chat.answerPresenceSubscription(\''+escapedJid+'\',\'subscribed\');" ' +
                    'class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only">'+$.icescrum.chat.o.i18n.yes+'</button> ' +
                    '<button onclick="$.icescrum.chat.answerPresenceSubscription(\''+escapedJid+'\',\'unsubscribed\');" ' +
                    'class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only">'+$.icescrum.chat.o.i18n.no+'</button>' +
                    '</div>');
        },

        cancelSubscription:function(escapedJid){
            if(confirm('Are you sure ?')){
                var sendRemove = $iq({type: 'set'})
                        .c('query', {'xmlns':Strophe.NS.ROSTER})
                        .c('item',{jid:$.icescrum.chat.unescapeJid(escapedJid),subscription:'remove'});
                $.icescrum.chat.o.connection.send(sendRemove.tree());
            }
        },

        _editableSelectList:function(){
            $('#chatstatus-button .ui-selectmenu-status')
            .bind('mousedown click keydown', function(event){
                event.stopPropagation();
                return false;
            })
            .editable($.icescrum.chat.customPresence,{
              type : 'statut-editable',
              onsubmit:function(settings,original){
                if($(this).find('input').val() == '' || $(this).find('input').val() == original.revert){
                  original.reset();
                  return false;
                }
              },
              width:'75px',
              select:true,
              height:'10px',
              onblur:'submit'
            });
        },

        insertEmoticon:function(escapedJid, pemot){
            var start = $("#ui-chat-input-box-"+escapedJid).getCaretPosition();
            var content = $("#ui-chat-input-box-"+escapedJid).val();
            var lastChar = content.substring(start-1,start);
            if (start == 0 || lastChar == " "){
                $("#ui-chat-input-box-"+escapedJid).insertAtCaret(pemot+" ");
            }else{
                $("#ui-chat-input-box-"+escapedJid).insertAtCaret(" "+pemot+" ");
            }
            $("#ui-chat-input-box-"+escapedJid).focus();

        },

        // Création ou ouverture du chat
        createOrOpenChat:function(id,escapedJid,toggle) {
            var idx1 = this.o.showList.indexOf(id);
            var idx2 = this.o.chatList.indexOf(id);
            // Si le chat est dans la showList
            // et que le toggle est à true
            // => minimise le chat
            if(idx1 != -1){
                if (toggle != undefined && toggle){
                    var managerd = $("#"+id).chat("option", "chatManager");
                    managerd.minimize();
                }
            }
            // Si le chat n'est pas dans la showList
            // et qu'il est dans la chatList
            // lance la fenêtre à l'offset courant
            // l'affiche et l'ajoute à la showList
            else if(idx2 != -1) {
                $("#"+id).chat("option", "offset", this._getNextOffset());
                var manager = $("#"+id).chat("option", "chatManager");
                manager.toggleChat();
                this.o.showList.push(id);
            }
            // Si le chat n'a jamais été ouvert
            // créé le chat avec ses paramètres
            // et l'ajoute à la showList et chatList
            else{
                var el = document.createElement('div');
                el.setAttribute('id', id);
                var rawJid = $.icescrum.chat.unescapeJid(escapedJid);
                var title = $('#chat-user-status-'+escapedJid).attr('name') ? $('#chat-user-status-'+escapedJid).attr('name') : rawJid;
                title = $.icescrum.chat.truncate(title,25);
                $(el).chat({id : id,
                            alert : this.o.i18n.alertNewMessages,
                            escapedJid : escapedJid,
                            status : $('#chat-user-status-'+escapedJid).attr('status') ? $('#chat-user-status-'+escapedJid).attr('status') : 'offline',
                            hidden : false,
                            width : this.o.width,
                            title : title,
                            offset : this._getNextOffset(),
                            messageSent : this.sendMessage,
                            chatClosed : this.closeChat,
                            stateSent : this.sendState
                      });
                this.o.chatList.push(id);
                this.o.showList.push(id);
            }
            if(this.o.showList.length>this.o.maxChats)  {
                     var idd = $.icescrum.chat.o.showList[0];
                     $.icescrum.chat.closeChat(idd);
            }
        },

        // Envoie msg au jid
        // et ajoute msg à la fenêtre de chat correspondant
        // Pourquoi id en parametre ? -> c'est l'ui qui envoie l'id de la fenetre ca peut être utile..
        sendMessage:function(id, escapedJid, msg){
            var rawJid = $.icescrum.chat.unescapeJid(escapedJid);
            msg = $('<pre>').text(msg).html();
            msg = $.icescrum.chat.displayBacklogElementUrl(msg,'story');
            var message = $msg({type: 'chat', to: rawJid})
                                                .c('body').t(msg[0])
                                                .up().c('active', {xmlns:'http://jabber.org/protocol/chatstates'});
            $.icescrum.chat.o.connection.send(message.tree());
            $("#chat-" + escapedJid).chat("option", "chatManager").addMsg($.icescrum.chat.o.i18n.me, msg[1]);
            console.log("[icescrum-chat] Message sent to "+rawJid);
        },

        // Ferme le chat id s'il est ouvert
        // En le retirant de la showList
        // Puis décale les fenêtres qui étaient à sa gauche
        closeChat:function(id) {
            var idx = $.icescrum.chat.o.showList.indexOf(id);
            $("#" + $.icescrum.chat.o.showList[idx]).chat("option", "hidden", true);
            if(idx != -1) {
                $.icescrum.chat.o.showList.splice(idx, 1);
                var diff = $.icescrum.chat.o.width + $.icescrum.chat.o.gap;
                for(var i = idx; i < $.icescrum.chat.o.showList.length; i++) {
                    var offset = $("#" + $.icescrum.chat.o.showList[i]).chat("option", "offset");
                    $("#" + $.icescrum.chat.o.showList[i]).chat("option", "offset", offset - diff);


                }
            }
        },

        presenceChanged:function(presence, show){
            if(show == 'disc'){
                $.icescrum.chat.changeStatus(presence, show, false);
                $.icescrum.chat.o.connection.flush();
                $.icescrum.chat.o.connection.disconnect();
                $.icescrum.chat._disconnected();
            }else{
                if(!$.icescrum.chat.o.connected){
                     $.icescrum.chat._initConnect();
                }
                else{
                    $.icescrum.chat.changeStatus(presence, show, false);
                }
            }
        },

        truncate:function(string, size){
            if(string.length>(size-1))
                return string.substring(0,size)+"...";
            else
                return string;
        },

        displayRoster:function(){
            if ($.icescrum.chat.o.connected){
                if ($('#chat-roster-list').is(':hidden')){
                    $('#chat-roster-list').show();
                    $('#chat-manage').show();
                    $('#chat-list-hide').css('display','block');
                    $('#chat-list-show').hide();
                    if ($("#chat-roster-list").find('.scrollbar-wrapper').length == 0){
                        $("#chat-roster-list").scrollbar({contentHeight:parseInt(200),position:'right'});
                    }
                }else{
                    $('#chat-roster-list').hide();
                    $('#chat-list-hide').hide();
                    $('#chat-manage').hide();
                    $('#chat-list-show').css('display','block');
                }
            }else{
                $('#chat-roster-list').hide();
                $('#chat-list-hide').hide();
                $('#chat-manage').hide();
                $('#chat-list-show').css('display','block');
            }
        },

        // Permet de modifier le statut
        // presence : message du status
        // show : chat, away, dnd, xp
        changeStatus:function(presence, show, saveCustom){
            var pres;
            if (show == 'disc'){
                pres = $pres({type: "unavailable"});
            }
            else if(show!= "online"){
            pres = $pres()
                    .c('status')
                        .t(presence).up()
                    .c('show')
                        .t(show);
            } else {
                pres = $pres()
                    .c('status')
                        .t(presence).up();
            }
            $.icescrum.chat.o.currentStatus.show = show;
            $.icescrum.chat.o.currentStatus.presence = presence;
            $.icescrum.chat.o.connection.send(pres.tree());
            $.ajax({type:'POST',
                global:false,
                data:'custom='+saveCustom+'&show='+show+'&presence='+presence,
                url: $.icescrum.o.grailsServer + '/chat/saveStatus',
                error:function() {
                    $.icescrum.renderNotice($.icescrum.chat.o.i18n.customStatusError,'error');
                }
            });
        },

        // Change l'image et le tooltip du statut
        changeImageStatus:function(escapedJid, status, show, type){
            //Subscription receive
            var user = $('.ui-chat-user-status-'+escapedJid);
            var userInList = $('#chat-user-status-'+escapedJid);
            var group = userInList.parent();

            if(type == 'unavailable'){
                group.append(userInList);
                $.icescrum.chat.o.hideOffline ? userInList.hide() : userInList.show();
                user.removeClass();
                userInList.attr('status','offline');
                user.addClass("grey-status ui-chat-user-status-"+escapedJid+" ui-chat-status ui-chat-status-offline");
                userInList.attr('title', '');
            } else {
                if(show.length > 0){
                    user.removeClass();
                    if (show == 'xa' || show == 'away'){
                        user.addClass("orange-status");
                    }else if(show == 'dnd'){
                        user.addClass("red-status");
                    }
                    userInList.attr('status',show);
                    user.addClass("ui-chat-user-status-"+escapedJid+" ui-chat-status ui-chat-status-"+show);
                }
                if(show.length == 0){
                    user.removeClass();
                    userInList.attr('status','chat');
                    user.addClass("green-status ui-chat-user-status-"+escapedJid+" ui-chat-status ui-chat-status-online");
                }
                user.show();
            }
            if(status.length > 0){
                $('.chat-tooltip-right .ui-chat-user-status-text-'+escapedJid).text(status);
                user.attr('title', status);
            } else {
                user.attr('title', '');
            }
            //On sort le global
            var sort = $.icescrum.chat.o.hideOffline ? group.find('li').not('ui-chat-status-offline') : group.find('li');
            sort.sortElements(function(a,b){
                var statusA = $(a);
                var statusB = $(b);
                var valA = statusA.hasClass('green-status') ? 2 : statusA.hasClass('red-status') ? 1 : statusA.hasClass('orange-status') ? 0 : -1;
                var valB = statusB.hasClass('green-status') ? 2 : statusB.hasClass('red-status') ? 1 : statusB.hasClass('orange-status') ? 0 : -1;
                return valA < valB ? 1 : -1;
            });
            group.find('li.green-status').sortElements(function(a,b){return $(a).text().toUpperCase() > $(b).text().toUpperCase() ? 1 : -1;});
            group.find('li.red-status').sortElements(function(a,b){return $(a).text().toUpperCase() > $(b).text().toUpperCase() ? 1 : -1;});
            group.find('li.orange-status').sortElements(function(a,b){return $(a).text().toUpperCase() > $(b).text().toUpperCase() ? 1 : -1;});
            if (!$.icescrum.chat.o.hideOffline){
                group.find('li.grey-status').sortElements(function(a,b){ return $(a).text().toUpperCase() > $(b).text().toUpperCase() ? 1 : -1;});
            }
            if (group.length > 0){
                var titleGroup = group.children('span').text();
                titleGroup = titleGroup.replace(/([0-9]*\/[0-9]*)/g,group.find('li').not('.grey-status').length+'/'+group.find('li').length);
                group.children('span').text(titleGroup);
            }
        },

        // Envoie le stanza qui indique un changement d'état
        sendState:function(escapedJid, state) {
            var rawJid = $.icescrum.chat.unescapeJid(escapedJid);
            var composingStateMessage = $msg({type: 'chat', to: rawJid})
                                        .c(state, {xmlns:'http://jabber.org/protocol/chatstates'});
            $.icescrum.chat.o.connection.send(composingStateMessage.tree());
            console.log("[icescrum-chat] " + state +  " state sent to " + rawJid);
        },

        // Gère la reception de chat states
        manageStateReception:function(msg, escapedJid){
            var state = '';
            var manager= $("#chat-" + escapedJid).chat("option", "chatManager");
            if(msg.getElementsByTagName('active').length > 0) {
                 state = 'active';
                 manager.hideComposing();
                 manager.hidePaused();
            }
            else if(msg.getElementsByTagName('composing').length > 0) {
                 state = 'composing';
                 manager.hidePaused();
                 manager.showComposing();

            }
            else if(msg.getElementsByTagName('paused').length > 0) {
                 state = 'paused';
                 manager.hideComposing();
                 manager.showPaused();

            }
            else if(msg.getElementsByTagName('gone').length > 0 || msg.getElementsByTagName('inactive').length > 0) {
                 state = 'gone/inactive';
                 manager.hideComposing();
                 manager.hidePaused();
            }
            if(state != '')
                console.log("[icescrum-chat] " + $.icescrum.chat.unescapeJid(escapedJid) + " is " + state);
        },

        mergeContactLists:function(jabberList,displayExternalContacts) {
            var teamList = $.parseJSON($.icescrum.chat.o.teamList);
            console.log("[icescrum-chat] Merging team members and jabber roster");
            $.icescrum.chat.addTeamContacts(teamList,jabberList);
            if(displayExternalContacts) {
                $.icescrum.chat.addJabberContacts(teamList,jabberList);
            }
            $.icescrum.chat.putContactLinks();
            $.icescrum.chat.finalizeContactList();
        },

        addTeamContacts:function(teamList, jabberList){
           $(teamList).each(function () {
                this.users = this.users.sort(function(a, b){return a.firstname > b.firstname ? 1 : -1;});
                var teamid = this.teamid;
                $('#chat-roster-list').append('<ul class="chat-group" id="team-'+teamid+'"><span class="chat-group-title">'+this.teamname+' (0/0)</span>');
                $(this.users).each(function(){
                    var user = this;
                    $(jabberList).each(function () {
                        if(this.rawJid == user.jid) {
                            $.icescrum.chat.addTeamContact(this.rawJid,user, teamid);
                        }else if(Strophe.getDomainFromJid(this.rawJid) == $.icescrum.chat.o.server){

                        }
                    });
                });
                $('#chat-roster-list').append('</ul>');
            });
        },

        addJabberContacts:function(teamList, jabberList) {
            jabberList = jabberList.sort(function(a, b){return a.name > b.name ? 1 : -1;});
            $('#chat-roster-list').append('<ul class="chat-group" id="team-non-icescrum"><span class="chat-group-title">'+$.icescrum.chat.o.i18n.teamNonIcescrum+' (0/0)</span>');
            $(jabberList).each(function(){
                var jabberUser = this;
                if(Strophe.getDomainFromJid(jabberUser.rawJid) != $.icescrum.chat.o.server) {
                   $.icescrum.chat.addJabberContact(jabberUser);
                }
                else {
                    var found = false;
                    $(teamList).each(function(){
                        $(this.users).each(function(){
                            if(this.username == Strophe.getNodeFromJid(jabberUser.rawJid)) {
                                found = true;
                            }
                        });
                    });
                    if(!found) {
                        $.icescrum.chat.addJabberContact(jabberUser);
                    }
                }
            });
        },

        addContact:function(teamid,rawJid,name,firstname) {
            var escapedJid = $.icescrum.chat.escapeJid(rawJid);
            if ($('#chat-user-status-' + escapedJid).length == 0){
                $('#team-'+teamid).append('<li id="chat-user-status-' + escapedJid + '" jid="'+escapedJid+'" name="'+$.icescrum.chat.truncate(name, 35)+'" firstname="'+firstname+'" class="ui-chat-user-status-'+escapedJid+' grey-status ui-chat-status ui-chat-status-offline" status="offline" title="">' +
                                            '<a href="javascript:;" class="chat-user-link">'+$.icescrum.chat.truncate(name, 35)+'</a>' +
                                            '<div class="chat-delete-contact"></div>' +
                                            '</li>');
            }
        },

        addTeamContact:function(rawJid,user,teamid) {
            $.icescrum.chat.addContact(teamid,rawJid,user.firstname +' '+user.lastname,user.firstname);
            $.ajax({
                type: "POST",
                url: $.icescrum.o.grailsServer + '/chat/showToolTip',
                data: 'id=' + user.id + '&escapedJid=' + $.icescrum.chat.escapeJid(rawJid),
                success:function(data) {
                    $('.chat-group').append(data);
                }
            });
        },

        addJabberContact:function(jabberUser){
            var teamid = "non-icescrum";
            var displayedName = jabberUser.name;
            if(displayedName == null || displayedName == 'null') {
                displayedName = Strophe.getNodeFromJid(jabberUser.rawJid);
            }
            $.icescrum.chat.addContact(teamid,jabberUser.rawJid,displayedName,displayedName)
        },

        putContactLinks:function() {
            $('.ui-chat-status,.tooltip-chat-user-link').die('click.chat').live('click.chat',function(event){
                $.icescrum.chat.createOrOpenChat('chat-'+$(this).attr('jid'),$(this).attr('jid'),true);
                event.preventDefault();
            });

            var showDelete;
            $('.chat-group li').hover(
                function(){
                    var del = $(this);
                    showDelete = setTimeout(function(){del.find('.chat-delete-contact').show();},2000);
                },
                function(){
                    clearTimeout(showDelete);
                    $(this).find('.chat-delete-contact').hide();
                }
            );

            $('.chat-delete-contact').die('click.delete').live('click.delete',function(event){
                $.icescrum.chat.cancelSubscription($(this).parent().find('.chat-user-link').attr('jid'));
                event.stopPropagation();
                event.preventDefault();
            });
        },

        finalizeContactList:function() {
            var nbContacts = 0;
            var nbContactsNotOffline = 0;
            $('.chat-group').each(function(){
               var group = $(this);
               var nbTeamContacts =  group.find('li').length;
               if(nbTeamContacts == 0) {
                   group.remove();
               }
               else{
                   nbContacts += nbTeamContacts;
               }
               var nbTeamContactNotOffline = group.find('li').not('.ui-chat-status-offline').length;
               nbContactsNotOffline += nbTeamContactNotOffline;
               var titleGroup = group.children('span').text();
               titleGroup = titleGroup.replace(/([0-9]*\/[0-9]*)/g,nbTeamContactNotOffline+'/'+nbTeamContacts);
               group.children('span').text(titleGroup);
            });
            $('.nb-contacts').html('('+nbContactsNotOffline+'/'+nbContacts+')');
            $.icescrum.chat.o.hideOffline ? $('#chat-roster-list .ui-chat-status-offline').hide() : $('#chat-roster-list .ui-chat-status-offline').show();
        },

        customPresence:function(val,settings){
            var presList = ['online','dnd','away'];
            if($("#chatstatus .status-custom").length < 6){
                var selected;
                for(pres in presList){
                    var newpres = $('<option></option>')
                        .attr("value", presList[pres])
                        .text(val)
                        .addClass("ui-chat-select ui-chat-status-"+presList[pres]+" status-custom");
                    if ($('#chatstatus-button').hasClass("ui-chat-status-"+presList[pres])){
                        selected = newpres;
                    }
                    $('#chatstatus .ui-chat-select.ui-chat-status-'+presList[pres]).not('.status-custom').last().after(newpres);
                }
                var opts = $("#chatstatus").selectmenu('settings');
                $("#chatstatus").selectmenu('destroy');
                $("#chatstatus").selectmenu(opts);
                $("#chatstatus").selectmenu('value',selected.index());
            }else{
                for(pres in presList){
                    $('#chatstatus .status-custom.ui-chat-select.ui-chat-status-'+presList[pres]+':last').text(
                        $('#chatstatus .status-custom.ui-chat-select.ui-chat-status-'+presList[pres]+':first').text()
                    );
                    $('#chatstatus .status-custom.ui-chat-select.ui-chat-status-'+presList[pres]+':first').text(val);
                    $('#chatstatus-menu .status-custom.ui-chat-select.ui-chat-status-'+presList[pres]+' a:last').text(
                        $('#chatstatus-menu .status-custom.ui-chat-select.ui-chat-status-'+presList[pres]+' a:first').text()
                    );
                    $('#chatstatus-menu .status-custom.ui-chat-select.ui-chat-status-'+presList[pres]+' a:first').text(val);
                }
            }
            $.icescrum.chat.changeStatus(val, $("#chatstatus").find('option:selected').val(),true);
            $.icescrum.chat._editableSelectList();
            return val;
        },

        escapeJid:function(rawJid) {
            return rawJid.replace(/\./g,'_point_').replace(/@/g,'_at_');
        },

        unescapeJid:function(escapedJid) {
            return escapedJid.replace(/_point_/g,'.').replace(/_at_/g,'@');
        },

        displayBacklogElementUrl:function(msg,type){
            var val = [msg,msg];
            var re = new RegExp(type+'-[0-9]*',"g");
            var stories = msg.match(re);
            if (stories){
                var ids = ['type='+type];
                $(stories).each(function(){
                    ids.push('id=' + this.replace(/story-/g,''));
                });
                $.ajax({type:'POST',
                    global:false,
                    data:ids.join('&'),
                    dataType:'json',
                    async:false,
                    url: $.icescrum.o.grailsServer + '/chat/urlMessage',
                    success:function(data) {
                        $(data).each(function(){
                            var reg = new RegExp(this.id,"g");
                            val[0] = val[0].replace(reg,'#'+this.id+': '+this.name+' / '+this.external+' #');
                            val[1] = val[1].replace(reg,'<a class="scrum-link" title=" '+this.id+' / '+this.estimation+' / '+this.state+' " href="'+this.internal+'">'+this.name+'</a>');
                        });
                    }
                });

            }
            return val;
        }
    }
})(jQuery);

jQuery.editable.addInputType('statut-editable', {
    element : function(settings) {
            var input = $('<input />');
            input.width(settings.width);
            input.height(settings.height);
            input.bind('mousedown',function(event){event.stopPropagation()}).bind('click',function(event){event.stopPropagation()}).keydown(function(event){event.stopPropagation()});
            $(this).append(input);
            return(input);
        }
});

jQuery.fn.sortElements = (function(){
    var sort = [].sort;
    return function(comparator, getSortable) {
        getSortable = getSortable || function(){return this;};
        var placements = this.map(function(){
            var sortElement = getSortable.call(this),
                parentNode = sortElement.parentNode,
                nextSibling = parentNode.insertBefore(
                    document.createTextNode(''),
                    sortElement.nextSibling
                );
            return function() {
                if (parentNode === this) {
                    throw new Error(
                        "You can't sort elements if any one is a descendant of another."
                    );
                }
                parentNode.insertBefore(this, nextSibling);
                parentNode.removeChild(nextSibling);
            };
        });
        return sort.call(this, comparator).each(function(i){
            placements[i].call(getSortable.call(this));
        });
    };
})();