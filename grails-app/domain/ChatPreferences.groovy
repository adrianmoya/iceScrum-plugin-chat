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

import org.icescrum.core.domain.User

class ChatPreferences {

  String[] statusList = new String[2]
  String show = "online"
  String presence

  String username
  String password
  String server
  boolean secure = false
  boolean hideOffline = true
  String boshPath = '/http-bind/'
  Integer port = 8080

  User user

  static transients = ['needConfiguration']

  static constraints = {
    statusList(nullable: false)
    show(nullable: false)
    presence(nullable: true)
    username(email:true)
  }

  static mapping={
    table 'icescrum_plugin_chat'
    show column:'show_col'
  }

  def needConfiguration = {
      return !(this.username && this.password && this.server && this.boshPath && this.port > 0)
  }
}