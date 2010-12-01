/*
 * Copyright (c) 2010 iceScrum Technologies.
 *
 * This file is part of iceScrum.
 *
 * iceScrum is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License.
 *
 * iceScrum is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with iceScrum.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Authors:
 *
 * Vincent Barrier (vincent.barrier@icescrum.com)
 *
 */

import org.icescrum.components.UtilsWebComponents
import org.icescrum.core.domain.User
import grails.plugins.springsecurity.Secured
import org.icescrum.plugins.chat.ChatUtils
import org.icescrum.plugins.chat.ChatConnection
import grails.converters.JSON

@Secured('ROLE_ADMIN')
class ChatAdminController {

    static final id = 'chatAdmin'
    static ui = true
    static menuBar = [show:[visible:UtilsWebComponents.rendered(renderedOnRoles:"ROLE_ADMIN"),pos:0],title:'is.ui.admin']
    static window =  [title:'is.ui.admin',help:'is.ui.admin.help',toolbar:false]

    def springSecurityService

    def index = {
      def server = ChatUtils.chatConfig.icescrum.chat.server
      def port = ChatUtils.chatConfig.icescrum.chat.port
      def resource = ChatUtils.chatConfig.icescrum.chat.resource
      render template:'chatAdmin',plugin:'icescrum-chat',
              model:[server: server,
                      port: port,
                      resource: resource
              ]
    }

    def modify = {
      ChatUtils.chatConfig.icescrum.chat.server = params.server
      ChatUtils.chatConfig.icescrum.chat.port = params.port
      ChatUtils.chatConfig.icescrum.chat.resource = params.resource
      render(status:200, contentType: 'application/json', text: [notice: [text: message(code: 'is.chat.ui.ismodify')]] as JSON)

    }
}
