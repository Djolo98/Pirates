var fe =
{
    loaded:
    {
        _complete:  0,
        scripts:    0,
        dom:        0
    },

    USER_TYPE_GUEST:    1,
    USER_TYPE_USER:     2,
    USER_TYPE_PRO:      3,
    USER_TYPE_ADMIN:    100,
    USER_TYPE_SUPERADMIN:    101,

    onLoad: function(/*object*/)
    {
        // Scripts + dom

        var instance = this;
        if (this.loaded[arguments[0]] == 2)
            return;
        this.loaded[arguments[0]] = 2;
        if (fe.onLoadCustom)
            fe.onLoadCustom(arguments[0]);
        if (this.loaded.scripts == 2 && this.loaded.dom  == 2 && this.loaded._complete != 2)
        {
            this.loaded._complete = 2;
            this.onLoadComplete();
        }
    },

    onLoadComplete: function()
    {
        var instance = this;
        geewa.app.callback = function () { instance.onListen.apply(instance, arguments) };

        if (global.connectToServer)
        {
            var instance = this;

            fe.loader.init();
            fe.loader.message('Connecting to server', 2, true);
            geewa.debug.reportLimit = global.reportErrors;
            //servers initialization
            geewa.server.proxyUrl = global.proxyServer;
            if (!geewa.server.ps)
                geewa.server.ps = new geewa.server.Server();
            geewa.server.ps.serverUrl = global.publicServer;
            geewa.server.ps.headers =
            {
                'X-GV': global.serverProtocolVersion,
                'Content-Type': 'application/x-json'
            };

            if (session && !session.user)
                fe.showOverlay('noCookies');

            //geewa client initialization
            if (session && session.sessionID) {
                var p =
                {
                    serverProtocolVersion: global.serverProtocolVersion,
                    userServerUrl: session.serverUrls.user,
                    onError: function () { instance.onServerError.apply(instance, arguments); },
                    onEvents: function () { instance.onEventServer.apply(instance, arguments); },
                    sessionID: session.sessionID
                };

                geewa.lite.init(p);
            }
        }

        this.traceImpress();

        if (window == top)
            document.body.style.overflow = 'auto';


        // Custom load events
        if (this.page && this.page.onLoad)
            this.page.onLoad();

        if (window == top)
            document.body.style.overflow = 'auto';
    },

    onListen: function (aData) {
        switch (aData.method) {
            case 'eventServer':
                if (fe.page.hashChange)
                    fe.page.onEventServer(aData.params[0], aData.params[1]);
                break;

            case 'canvasSize':
                if (fe.page.hashChange)
                    fe.page.onResize(aData.params[0]);
                break;

            case 'setWidgetHeight':
                var e = fe.getIDs(aData.params[0] + 'Frame');
                if (e[0])
                    e[0].style.height = aData.params[1] + 'px';

                geewa.app.fixPageHeight();
                break;

            case 'hashChange':
                if (fe.page.hashChange)
                    fe.page.hashChange.apply(fe.page, aData.params);
                break;

            case 'adFinish':
                if (fe.page.hashChange)
                    fe.page.callGame('advertContinue');
                break;

            case 'goBack':
                if (fe.page.hashChange)
                    fe.page.callGame('goBack');
                break;
        }
    },

    traceImpress: function()
    {
        p = {};
        p.version = fe.version;

        try {
            p.browser = session.browser;
            p.os = fe.analytics.getOS();
            p.screen = { width: screen.availWidth, height: screen.availHeight, colorDepth: screen.colorDepth };
            p.flash = fe.getFlashVersion().join('.');
        }
        catch (ex) {
        }

        var qsParam = ['utm_source', 'utm_medium', 'utm_term', 'utm_content', 'utm_campaign'];
        for (var i = 0; i < qsParam.length; i++) {
            x = geewa.queryString(qsParam[i]);
            if (x)
                p[qsParam[i]] = x;
        }
        fe.analytics.track('/load-page', p);
    },

    onError: function(/* message, script, line */)
    {
        if (fe.page.onError) {
            fe.page.onError.apply(fe.page, arguments);
        }

        if (typeof (arguments[0]) == 'string')
        {
            //problem in Firefox with loading scripts
            if (arguments[0].match(/Error loading script/))
                return;

            //problem with chrome extension
            if (arguments.length > 1 && arguments[1].match(/chrome-extension/))
                return;

            //error on line 0 (error in some addons file)
            if (arguments.length > 2 && arguments[2] === 0)
                return;

            if (!this._errorCount)
                this._errorCount = 0;
            if (this._errorCount >= global.traceErrorCount)
                return;

            var o = {'arguments':[]};
            for (i = 0; i < arguments.length; i++)
                o['arguments'].push(arguments[i]);

            //console.log("Error: " + o['arguments']);

            fe.trace.send({ subtype1: 'error', subtype2: o['arguments'] });

            this._errorCount++;
        }

        return true;
    },

    getIDs: function()
    {
        var e = [];
        for (var i = 0; i < arguments.length; i++)
            e.push(document.getElementById(arguments[i]));
        return e;
    },


    /************************************************
    /*
    /*      POPUP
    /*
    /************************************************/

    popup:
    {
        closePaymentBeta: function (/*[disable close callback]*/) {

            this.active = false;

            var e = fe.getIDs('popupOverlay', 'popupWindowPayment');

            e[0].style.display = 'none';
            e[1].style.display = 'none';
            if (this.params) {
                if (this.params.onClose && (arguments.length === 0 || !arguments[0]))
                    this.params.onClose();
                delete this.params;
            }

            SendMessage('UnityPluginBridge', 'Perform', '{ "section": "store", "method": "OnPurchaseCancelledEvent", "data": {} }')
        },

        closePaymentBanks: function () {
            document.getElementById('popupWindowPaymentBanks').style.display = 'none';
        },

        show: function () {
            //geewa.debug.log('fe','popup.show');
            var e = fe.getIDs('popupOverlay', 'popupWindow', 'popupTitle', 'popupContent', 'main', 'popupButtons', 'popupSubTitleBox', 'popupSubTitle', 'popupClose');
            if (this.active)
                this.close();

            this.active = true;

            fe.page.switchFlashVisibility(false);

            this.params = arguments[0];
            e[2].innerHTML = this.params.title;
            e[3].innerHTML = this.params.body;
            e[0].style.display = 'block';
            e[0].style.height = e[4].scrollHeight + 'px';
            e[1].style.display = 'block';
            e[1].style.marginLeft = parseInt(e[1].offsetWidth * -0.5, 10) + 'px';
            e[1].style.top = '65px';

            if (this.params.solidBackground) {
                geewa.addClass(e[1], 'pop-window-new-solid-background');
                e[3].style.background = this.params.solidBackground;
            }
            else {
                geewa.removeClass(e[1], 'pop-window-new-solid-background');
                e[3].style.background = null;
            }

            if (this.params.buttons || this.params.leftButtons) {
                var o = [];

                if (this.params.leftButtons)
                    o.push('<div style="float: left;">' + this.params.leftButtons + '&nbsp;</div>');

                if (this.params.buttons)
                    o.push('&nbsp;' + this.params.buttons);

                e[5].innerHTML = o.join('');
                e[5].style.display = 'block';
            }

            if (this.params.subTitle) {
                e[6].style.display = 'table-row';
                e[7].innerHTML = this.params.subTitle;
            }

            if (this.params.disableClose)
                e[8].style.display = 'none';
        },

        close: function (/*[disable close callback]*/) {
            if (!this.active)
                return;

            if (!this.params.onBeforeClose || this.params.onBeforeClose()) {
                this.active = false;

                fe.page.switchFlashVisibility(true);

                var e = fe.getIDs('popupOverlay', 'popupWindow', 'popupTitle', 'popupContent', 'adILayer', 'popupButtons', 'popupSubTitleBox', 'popupSubTitle', 'popupClose');
                e[3].innerHTML = '';
                e[2].innerHTML = '';
                e[0].style.display = 'none';
                e[1].style.display = 'none';
                e[1].style.marginLeft = '';
                e[5].innerHTML = '';
                e[5].style.display = 'none';
                e[6].style.display = 'none';
                e[7].innerHTML = '';
                e[8].style.display = '';
                //adILayer - temporary thanks to non transparent Seznam banners
                if (e[4])
                    e[4].style.visibility = 'visible';
                if (this.params) {
                    if (this.params.onClose && (arguments.length === 0 || !arguments[0]))
                        this.params.onClose();
                    delete this.params;
                }
            }
        },
    },


    /************************************************
    /*
    /*      DOM
    /*
    /************************************************/

    dom:
    {
        init: function(/*callback*/)
        {
            this.callback = arguments[0];
            // Catch cases where $(document).ready() is called after the
            // browser event has already occurred.
            var instance = this;
            if (document.readyState == 'complete')
                instance.doCallback();

            // Mozilla, Opera and webkit nightlies currently support this event
            if (document.addEventListener)
            {
                // Use the handy event callback
                document.addEventListener('DOMContentLoaded', instance.doCallback, false );
                // A fallback to window.onload, that will always work
                window.addEventListener('load', instance.doCallback, false );
            // If IE event model is used
            }
            else if (document.attachEvent)
            {
                // ensure firing before onload,
                // maybe late but safe also for iframes
                document.attachEvent('onreadystatechange', instance.onLoad);

                // A fallback to window.onload, that will always work
                window.attachEvent('onload', instance.doCallback);
            }
        },

        onLoad: function()
        {
            // Cleanup functions for the document ready method
            var instance = fe.dom;
            if (document.addEventListener)
            {
                document.removeEventListener('DOMContentLoaded', instance.onLoad, false);
                document.removeEventListener('load', instance.doCallback, false);
                instance.doCallback();
            }
            else if (document.attachEvent && document.readyState == 'complete')
            {
                document.detachEvent('onreadystatechange', instance.onLoad);
                document.detachEvent('onload', instance.doCallback);
                instance.doCallback();
            }
        },

        doCallback: function()
        {
            var instance = fe.dom;
            if (instance.callback)
            {
                instance.callback();
                delete instance.callback;
            }
        }
    },


    /************************************************

          ANALYTICS

    ************************************************/

    analytics:
    {
        _errors: 0,
        _state: 0, //0 - not initialized, 1 - do not track, 2 - track
        _cache: [],
        _cacheIndex: 0,

        track: function (aPage/*, [parameters], [trackGA], [trackFromNow] */) {
            var parameters = arguments.length > 1 ? arguments[1] : null;
            //track GA
            //if (arguments.length < 3 || arguments[2])
            //{
            //    if (parameters)
            //        this.trackGA(aPage, parameters);
            //    else
            //        this.trackGA(aPage);
            //}

            //to internal analytics track only registered user
            if (session.user.type < fe.USER_TYPE_USER)
                return;

            //check track status
            if (arguments.length > 3 && arguments[3]) {
                this.flushCache();
                this._state = 2;
            }
                //track users registered before traceHoursFromRegistration parameter
            else if (this._state === 0)
                this._state = 2;//global.traceHoursFromRegistration == -1 || parseInt((geewa.server.time.now() - session.user.createTime) / 3600000, 10) > global.traceHoursFromRegistration ? 1 : 2;

            var d = {};
            d.source = 'geewa-platform';
            d.activity = 'pirates-poker';
            d.action = aPage;
            if (parameters)
                d.parameters = parameters;
            var now = new Date();
            d.clientTime = now.valueOf() - now.getTimezoneOffset() * 60000;
            d.systemInfo = this.getSystemInfo();
            d.pageVersion = fe.version;
            if (fe.page._gameVersion)
                d.gameVersion = fe.page._gameVersion;
            d.cacheKey = global.cacheKey;
            if (typeof (session) != 'undefined') {
                d.sessionID = session.sessionID;
                if (session.user) {
                    d.userID = session.user.userID;
                    if (session.user.location)
                        d.country = session.user.location.alpha3;
                }
            }
            if (this.speed) {
                d.speed = this.speed[0];
                d.speedCDN = this.speed[1];
            }
            else
                //this._testSpeed();
                var x = this._getClientID();
            if (x)
                d.clientID = x;
            d.domain = session.user.domain;

            if (this._state == 2) {
                var img = new Image();
                img.src = global.traceServer + '?' + encodeURIComponent(geewa.encodeJSON(d));
            }
            else
                this.putToCache(d);
        },

        putToCache: function (aParams) {
            var qs = encodeURIComponent(geewa.encodeJSON(aParams));
            switch (aParams.action) {
                case '/load-page':
                case '/load-game':
                    this._cache.splice(this._cacheIndex, 1, qs);
                    this._cacheIndex++;
                    break;

                default:
                    this._cache.push(qs);
                    if (this._cache.length > (5 + this._cacheIndex))
                        this._cache.splice(this._cacheIndex, 1);
                    break;
            }
        },

        flushCache: function () {
            for (var i = 0; i < this._cache.length; i++) {
                var img = new Image();
                img.src = global.traceServer + '?' + this._cache[i];
            }
            this._cache = [];
        },

        getSystemInfo: function () {
            if (!this._systemInfo) {
                this._systemInfo =
                {
                    screen: screen.availWidth + 'x' + screen.availHeight + 'x' + screen.colorDepth,
                    flash: this.flashVersion().toString().replace(/,/g, '.'),
                    os: this.getOS(),
                    cdn: global.cdn.id,
                    https: (location.protocol == 'https:')
                };

                if (window.console && window.console.firebug)
                    this._systemInfo.firebug = window.console.firebug;
            }

            return this._systemInfo;
        },

        getOS: function () {
            var ua = navigator.userAgent;
            var os = 'unknown';
            if (ua.indexOf('Win') != -1) {
                if (ua.match(/Windows NT 5\.1|Windows XP/))
                    os = 'Win XP';
                else if (ua.match(/Windows NT 7\.0|Windows NT 6\.1/))
                    os = 'Win 7';
                else if (ua.match(/Windows NT 6\.0/))
                    os = 'Win Vista/Server 08';
                else if (ua.match(/Windows ME/))
                    os = 'Win ME';
                else if (ua.match(/Windows NT 4\.0|WinNT/))
                    os = 'Win NT';
                else if (ua.match(/Windows NT 5\.2/))
                    os = 'Win Server 03';
                else if (ua.match(/Windows NT 5\.0|Windows 2000/))
                    os = 'Win 2000';
                else if (ua.match(/Windows 98|Win98/))
                    os = 'Win 98';
                else if (ua.match(/Windows 95|Win95|Windows_95/))
                    os = 'Win 95';
                else if (ua.match(/Win16/))
                    os = 'Win 3.1';
                else
                    os = 'Win unknown';
                if (ua.match(/WOW64|x64|Win64|IA64/))
                    os += ' (x64)';
                else
                    os += ' (x32)';
            }
            else if (ua.match(/Mac/))
                os = 'MacOS';
            else if (ua.match(/X11/))
                os = 'UNIX';
            else if (ua.match(/Linux/))
                os = 'Linux';
            return os;
        },

        trackGemius: function () {
            if (typeof (pp_gemius_identifier) != 'undefined') {
                try {
                    gemius_hit(pp_gemius_identifier);
                }
                catch (e) {
                }
            }
        },

        _testSpeed: function () {
            this.speed = [-1, -1];
            this._speedStart = new Date().valueOf();
            this._speedImg = [new Image(), new Image()];
            var instance = this;
            this._speedImg[0].onload = function () { instance._onTestComplete(0); };
            this._speedImg[0].src = 'http://cz.static.geewa.net/ok.png?' + this._speedStart;
        },

        _onTestComplete: function (aIndex) {
            //size: 10240 bytes
            this.speed[aIndex] = parseInt(10240000 / (new Date().valueOf() - this._speedStart), 10);
            if (aIndex == 1) {
                delete this._speedImg;
                delete this._speedStart;
                //this.detectCDN();
            }
            else {
                this._speedStart = new Date().valueOf();
                var instance = this;
                this._speedImg[1].onload = function () { instance._onTestComplete(1); };
                this._speedImg[1].src = 'http://geewaspeedtest.r.worldssl.net/ok.png?' + this._speedStart;
            }
        },

        //        detectCDN: function()
        //        {
        //            var s = document.createElement('script');
        //            s.src = 'http://cdn.static.geewa.net/id.js';
        //            s.type = 'text/javascript';
        //            document.body.appendChild(s);
        //            this._script = s;
        //            var instance = this;
        //            setTimeout(function(){instance.onDetectCDN();}, 5000);
        //        },

        //        onDetectCDN: function()
        //        {
        //            if (arguments.length > 0)
        //            {
        //                this.cdn = arguments[0];
        //                this.track('/internal/cdn-tested', null, false);
        //            }
        //            if (this._script)
        //            {
        //                document.body.removeChild(this._script);
        //                delete this._script;
        //            }
        //        },

        _getClientID: function () {
            if (typeof (localStorage) == 'undefined')
                return null;
            var id = localStorage.getItem('clientID');
            if (id)
                return id;
            var x = '0' + parseInt(Math.random() * 100, 10);
            id = new Date().valueOf() + x.substr(x.length - 2, 2);
            localStorage.setItem('clientID', id);
            return id;
        },

        flashVersion: function () {
            var version = [0, 0, 0];
            if (navigator.plugins && navigator.mimeTypes.length) {
                var x = navigator.plugins['Shockwave Flash'];
                if (x && x.description)
                    version = x.description.replace(/([a-zA-Z]|\s)+/, "").replace(/(\s+r|\s+b[0-9]+)/, '.').split('.');
            }
            else {
                var axo;
                for (var i = 11; i > 5; i--) {
                    try {
                        axo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash.' + i);
                        if (axo)
                            break;
                    }
                    catch (e) {
                    }
                }
                if (!axo)
                    try {
                        axo = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');
                    }
                    catch (e) {
                    }
                if (axo)
                    version = axo.GetVariable('$version').split(' ')[1].split(',');
            }
            return version;
        }
    },

    /************************************************
    /*
    /*      SUPPORT FUNCTIONS
    /*
    /************************************************/

    cookieWrite: function () {
        if (typeof (localStorage) != 'undefined')
            localStorage.setItem(arguments[0], arguments[1]);
        else
            geewa.cookieWrite(arguments[0], arguments[1]);
    },

    cookieRead: function () {
        if (typeof (localStorage) != 'undefined')
            return localStorage.getItem(arguments[0]);
        else
            return geewa.cookieRead(arguments[0]);
    },

    addStyle: function (aID, aStyle) {
        var e = (typeof (aID) == 'string' ? document.getElementById(aID) : aID);
        if (e && e.className.indexOf(' ' + aStyle) == -1)
            e.className += ' ' + aStyle;
    },

    removeStyle: function (aID, aStyle) {
        var e = (typeof (aID) == 'string' ? document.getElementById(aID) : aID);
        if (e) {
            if (e.className == aStyle)
                e.className = '';
            if (e.className.indexOf(' ' + aStyle) > -1)
                e.className = eval('e.className.replace(/ ' + aStyle + '/g,\'\')');
        }
    },

    timeBefore: function (aTime/*, [now] */) {
        /// <summary>Returns a localized string of time like before 5 minutes.</summary>
        /// <param name="aName" type="Date">The Date object.</param>
        /// <param name="aNow" type="Date" optional="true">Default is new Date() but usefull is used geewa.server.time.now() as server's now</param>
        /// <returns type="String">Returns a localized string of time like before 5 minutes.</returns>
        var now = (arguments.length > 1 ? arguments[1] : new Date().valueOf());
        var d = parseInt((now - aTime) / 1000, 10);
        //seconds
        if (d < 60)
            return geewa.stringAppend(d > 1 ? l.gl('time.secondsAgo') : l.gl('time.secondAgo'), d);
        //minutes
        d = parseInt(d / 60, 10);
        if (d < 60)
            return geewa.stringAppend(d > 1 ? l.gl('time.minutesAgo') : l.gl('time.minuteAgo'), d);
        //hours
        d = parseInt(d / 60, 10);
        if (d < 24)
            return geewa.stringAppend(d > 1 ? l.gl('time.hoursAgo') : l.gl('time.hourAgo'), d);
        //days
        d = parseInt(d / 24, 10);
        if (d < 7)
            return geewa.stringAppend(d > 1 ? l.gl('time.daysAgo') : l.gl('time.dayAgo'), d);
        //weeks
        if (d < 30) {
            d = parseInt(d / 7, 10);
            return geewa.stringAppend(d > 1 ? l.gl('time.weeksAgo') : l.gl('time.weekAgo'), d);
        }
        //months
        if (d < 365) {
            d = parseInt(d / 30, 10);
            return geewa.stringAppend(d > 1 ? l.gl('time.monthsAgo') : l.gl('time.monthAgo'), d);
        }
        //years
        d = parseInt(d / 365, 10);
        return geewa.stringAppend(d > 1 ? l.gl('time.yearsAgo') : l.gl('time.yearAgo'), d);
    },

    getIDs: function () {
        var e = [];
        for (var i = 0; i < arguments.length; i++)
            e.push(document.getElementById(arguments[i]));
        return e;
    },

    arrayHasValue: function (aArray, aValue) {
        for (var i = 0; i < aArray.length; i++)
            if (aArray[i] == aValue)
                return true;
        return false;
    },

    tryValue: function (/*object, properties, [default]*/) {
        try {
            var x = arguments[0];
            var z = arguments[1].split('.');
            for (var i = 0; i < z.length; i++)
                x = x[z[i]];
            if ((x || x === 0) && typeof (x) != 'undefined')
                return x;
        }
        catch (e) {
        }
        return arguments.length < 3 ? null : arguments[2];
    },

    getDomain: function (aUrl) {

        var o = (aUrl ? aUrl : '');
        var i = o.indexOf('//');
        if (i > -1)
            o = o.substr(i + 2);
        i = o.indexOf('/');
        if (i > -1)
            o = o.substr(0, i);
        var parts = o.split('.');
        var ret = '';
        for (i = parts.length - 1; i >= 0; i--) {
            ret = parts[i] + '.' + ret;
            if (parts[i].length > 3)
                break;
        }
        if (ret.substring(ret.length - 1) == '.')
            ret = ret.substring(0, ret.length - 1);
        return ret;
    },

    numFormat: function (aNumber) {
        var x = String(aNumber).split('.');
        var rgx = /(\d+)(\d{3})/;
        while (rgx.test(x[0]))
            x[0] = x[0].replace(rgx, '$1' + '.' + '$2');
        return x.join(',');
    },

    shortNumFormat: function (aNumber) {
        if (aNumber < 1000)
            return String(aNumber);

        var result;
        var unit;

        if (aNumber >= 1000000) {
            result = parseInt(aNumber / 100000, 10) / 10;
            unit = "M";
        }
        else {
            result = parseInt(aNumber / 100, 10) / 10;
            unit = "K";
        }

        if (result == parseInt(result, 10))
            unit = ".0" + unit;

        return result + unit;
    },

    getFirstFromArray: function (aArray, aProp, aValue) {
        if (aArray)
            for (var i = 0; i < aArray.length; i++) {
                if (aArray[i][aProp] == aValue) {
                    return aArray[i];
                }
            }
        return null;
    },

    getIndexFromArray: function (aArray, aProp, aValue) {
        if (aArray)
            for (var i = 0; i < aArray.length; i++) {
                if (aArray[i][aProp] == aValue) {
                    return i;
                }
            }
        return null;
    },

    removeFirstFromArray: function (aArray, aProp, aValue) {
        if (aArray)
            for (var i = 0; i < aArray.length; i++) {
                if (aArray[i][aProp] == aValue) {
                    aArray.splice(i, 1);
                    return true;
                }
            }
        return false;
    },

    arrayContains: function (aArray, aValue) {
        if (aArray)
            for (var i = 0; i < aArray.length; i++) {
                if (aArray[i] == aValue) {
                    return true;
                }
            }
        return false;
    },

    getFlag: function (user) {
        var alpha3 = 'unknown';
        var country = '';

        if (user) {
            if (user.location_home) {
                alpha3 = user.location_home.alpha3;
                country = user.location_home.country;
            }
            else if (user.location) {
                alpha3 = user.location.alpha3;
                country = user.location.country;
            }
        }

        return '<img src="' + session.serverUrls.flags + 'w22/' + alpha3 + '.png" alt="" title="' + country + '" class="flag" />';
    },

    getFlagByAlpha3: function (alpha3) {
        return '<img src="' + session.serverUrls.flags + 'w22/' + alpha3 + '.png" alt="" class="flag" />';
    },
}

fe.trace = {
    send: function (obj) {

        var data = {
            userID: (session.user && session.user.type > 1 ? session.user.userID : '0@0'),
            gameID: 'portal',
//            gameID: global['gameID'],
            eventSuffix: global['eventSuffix'],
            action: obj.action            
        };

        $.extend(data, obj);

        if (data.date1)
            data.date1 = this._formatDate(data.date1);

        if (data.date2)
            data.date2 = this._formatDate(data.date2);

        if (data.data && typeof(data.data) == 'object')
            data.data = geewa.encodeJSON(data.data);

        fe.ls.call(function() { }, 'traceSend', geewa.encodeJSON(data));
    },

    _formatDate: function(date) {
        if (typeof (date) == 'number')
            date = new Date(date);

        return date.valueOf();
    }
};

/************************************************
/*
/*      PAYMENT
/*
/************************************************/

fe.payment = {

    _showProductBeta: function (payment) {

        this.payment = payment;

        if (fe.pt)
            fe.pt._trackEvent('payment', this.type);

        document.getElementById('paymentDialog').innerHTML = '<div id="popupWindowPayment" style="display: block;"><div id="paymentHeader"><span id="paymentReference"></span><span id="paymentTitle">Pool Live Tour: Champions</span><a href="javascript:void(0);" id="paymentClose" title="Zavřít" onclick="fe.popup.closePaymentBeta();">×</a>            </div><div id="paymentDialogProductsHeader" class="payment-subheader"><span id="paymentProductTitle" class="payment-subheader-title">Je nám líto, ale v demo verzi hry nejsou platby povoleny</span></div></div>'


        var popupOverlay = document.getElementById("popupOverlay");
        var popupWindowPayment = document.getElementById("popupWindowPayment");

        popupOverlay.style.display = 'block';
        popupWindowPayment.style.display = 'block';
    },

    onClose: function () {
        if (this.callback)
            this.callback();
    },
},

/************************************************

  LS - TRACE

************************************************/

fe.trace = {
    send: function (obj) {
        var data = {
            userID: (session.user && session.user.type > 1 ? session.user.userID : '0@0'),
            gameID: 'portal',
            eventSuffix: '',
            string1: global['gameID']
        };

        $.extend(data, obj);

        if (data.date1)
            data.date1 = this._formatDate(data.date1);

        if (data.date2)
            data.date2 = this._formatDate(data.date2);

        if (data.data && typeof (data.data) == 'object')
            data.data = geewa.encodeJSON(data.data);

        geewa.app.call('sendTrace', data);

        //fe.ls.call(function () { }, 'traceSend', geewa.encodeJSON(data));
    },

    _formatDate: function (date) {
        if (typeof (date) == 'number')
            date = new Date(date);

        return date.valueOf();
    }
};



/************************************************

  LS - LOCAL SERVER

************************************************/

fe.ls =
    {
        waiting: [],
        current: null,
        xmlObj: null,

        call: function()
        {
            var call = {};
            var iFrom = (typeof (arguments[0]) == 'string' ? 0 : 1);
            if (iFrom == 1)
                call.callback = arguments[0];
            call['arguments'] = [];
            for (var i = 0; i < (arguments.length - iFrom); i++)
                call['arguments'].push(arguments[i + iFrom]);
            //set parameters to session object
            if (arguments[iFrom] == 'setSession')
            {
                var x = arguments[iFrom + 1].split('|');
                i = 0;
                while (i < x.length)
                {
                    if (x[i] && x[i+1])
                        session[x[i]] = x[i+1];
                    i = i + 2;
                }
            }
            this.waiting.push(call);
            this._process();
        },

        _process: function()
        {
            if (this.current || this.waiting.length === 0)
                return false;

            this.current = this.waiting.shift();
            if (window.XMLHttpRequest)
                this.xmlObj = new XMLHttpRequest();
            else if (window.ActiveXObject)
                this.xmlObj = new ActiveXObject('Microsoft.XMLHTTP');
            else
                return false;
            var instance = this;
            this.xmlObj.onreadystatechange = function() { instance._onResponse.apply(instance, arguments); };
            this.xmlObj.open('POST', resolveUrl('/proxyLocal/getLocal.ashx'), true);//resolveUrl('/proxyLocal/getLocal.ashx')
            var o = [];
            var a = this.current['arguments'];
            for (var i = 0; i < a.length; i++)
                o.push(a[i]);
            this.xmlObj.send(o.join('\n'));
            //geewa.debug.log('ajax', 'local.send', o.join(', '));
            return true;
        },

        _onResponse: function()
        {
            if (this.xmlObj.readyState != 4)
                return;

            if (this.xmlObj.status == 200)
            {
                //geewa.debug.log('ajax', 'local.response', this.xmlObj.responseText);
                var result = eval('(' + this.xmlObj.responseText + ')');
                if (this.current['arguments'][0] === 'restart')
                    alert('Server was restarted!');
                if (this.current.callback)
                    this.current.callback(this.current, result);
            }
            else
            {
                //TODO: local error
                //alert(that.xmlObj.responseText);
            }
            delete this.current;
            this._process();
        }
    },


/************************************************
/*
/*      PRELOADER
/*
/************************************************/

fe.loader =
    {
        init: function()
        {
            this._startTime = new Date().valueOf();
            this.onTime();
        },

        message: function(aMsg/*, [State], [withDots]*/)
        {
            var e = document.getElementById('loaderMessage');
            if (arguments.length > 1)
                this.state = arguments[1];
            if (e)
            {
                var o = aMsg;
                if (arguments.length > 2)
                    o += ' <span id="loaderDots" style="display: inline-block; width: 24px; text-align: left;">.</span>';
                e.innerHTML = o;
            }
        },

        destroy: function()
        {
            var e = document.getElementById('loaderBody');
            if (e)
                e.parentNode.removeChild(e);
            if (this._timer)
                clearTimeout(this._timer);
            delete fe.loader;
        },

        onTime: function()
        {
            if (this._timer)
                clearTimeout(this._timer);
            var e = document.getElementById('loaderDots');
            if (e)
            {
                if (e.innerHTML.length < 6)
                    e.innerHTML += '.';
                else
                    e.innerHTML = '.';
            }
            var d = parseInt((new Date().valueOf() - this._startTime) / 1000, 10);
            switch (this.state)
            {
                case 3:
                    if (d > 10)
                        this.message(l.gl('facebookApp.loader.loading2'), 4, true);
                    break;
                case 4:
                    if (d > 20)
                    {
                        var o = [];
                        o.push(l.replaceTokens(l.gl('facebookApp.loader.loading3'), '<a href="javascript:void(0);" onclick="fe.analytics.track(\'/loader/reload-page\',null,true);location.reload();">', '</a>'));
                        this.message(o.join(''), 5);
                    }
                    break;
            }
            var instance = this;
            setTimeout(function(){instance.onTime()}, 500);
        }
    },




l.replaceTokens = function (/*text, tokensNameValueObject | token0, [token1] */) {
    var x = arguments[0];
    var i = 1;
    var values = [];
    if (typeof (arguments[i]) == 'object') {
        values = arguments[i];
        i++;
    }
    if (arguments.length > i) {
        var j = 0;
        while (i < arguments.length) {
            values[j++] = arguments[i];
            i++
        }
    }
    var bError = false;
    do {
        var nCount = 0;
        x = x.replace(/\{.[^\{\}]*\}/g, replaceBrackets);
    }
    while (nCount > 0 && !bError);
    return x;

    function replaceBrackets() {
        nCount++;
        var x = arguments[0];
        x = x.substr(1, x.length - 2);
        var i = x.indexOf('?');
        if (i == -1)
            return getValue(x);
        else {
            var value = getValue(x.substr(0, i));
            x = x.substr(i + 1).split('|');
            for (var i = 0; i < x.length; i++) {
                var j = x[i].indexOf(':');
                var tmp = x[i].substr(0, j);
                if (tmp == value || tmp == 'default')
                    return x[i].substr(j + 1);
                else {
                    tmp = tmp.split(',');
                    if (tmp.length > 1) {
                        for (var k = 0; k < tmp.length; k++)
                            if (tmp[k] == value)
                                return x[i].substr(j + 1);
                    }
                }
            }
            bError = true;
            return arguments[0];
        }
    }

    function getValue() {
        var x = values[arguments[0]];
        if (typeof (x) != 'undefined')
            return x;
        else {
            switch (arguments[0]) {
                case 'gender':
                    return (session.user.gender == 2 ? 'f' : 'm');

                default:
                    bError = true;
                    x = '{' + arguments[0] + '}';
                    return x;
            }
        }
    }
}




fe.dom.init(function(){fe.onLoad('dom');});

﻿fe.flash =
{
    _status: 0,

    HTML: function (/* params */) {
        var p = {};
        for (var i in arguments[0])
            p[i] = arguments[0][i];

        if (p.flashvars && typeof (p.flashvars) == 'object')
            p.flashvars = 'params=' + escape(geewa.encodeJSON(p.flashvars)).replace(/\+/g, '%2B');

        //params
        var fp = ['base', 'quality', 'allowscriptaccess', 'wmode', 'flashvars', 'allowfullscreen', 'allowfullscreeninteractive'];
        //defaults
        var fpd = [null, 'high', 'always', null, null, null, null];
        for (var i = 0; i < fp.length; i++) {
            if (!p[fp[i]] && fpd[i])
                p[fp[i]] = fpd[i];
        }
        var o = [];
        if (navigator.userAgent.indexOf('MSIE ') > -1) {
            o.push('<object ');
            if (p.id)
                o.push('id="' + p.id + '" ');
            o.push('width="' + p.width + '" height="' + p.height + '" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codeBase="http://fpdownload.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=9,0,47,0">');
            o.push('<param name="movie" value="' + p.url + '"/>');
            for (var i = 0; i < fp.length; i++) {
                if (p[fp[i]])
                    o.push('<param name="' + fp[i] + '" value="' + p[fp[i]] + '"/>');
            }
            o.push('</object>');
        }
        else {
            o.push('<embed');
            if (p.id)
                o.push(' id="' + p.id + '"');
            o.push(' width="' + p.width + '"');
            o.push(' height="' + p.height + '"');
            o.push(' src="' + p.url + '"');
            for (var i = 0; i < fp.length; i++) {
                if (p[fp[i]])
                    o.push(' ' + fp[i] + '="' + p[fp[i]] + '"');
            }
            o.push(' type="application/x-shockwave-flash"');
            o.push(' pluginspage="http://www.macromedia.com/go/getflashplayer"');
            o.push('/>\n');
        }
        return o.join('');
    },

    getFlashVersion: function () {
        var playerVersion = [0, 0, 0];
        var d = null;

        if (typeof (window.navigator.plugins) != 'undefined' && typeof (window.navigator.plugins['Shockwave Flash']) == 'object') {
            d = window.navigator.plugins['Shockwave Flash'].description;

            if (d && !(typeof (window.navigator.mimeTypes) != 'undefined' && window.navigator.mimeTypes['application/x-shockwave-flash'] && !window.navigator.mimeTypes['application/x-shockwave-flash'].enabledPlugin)) {
                d = d.replace(/^.*\s+(\S+\s+\S+$)/, '$1');
                playerVersion[0] = parseInt(d.replace(/^(.*)\..*$/, '$1'), 10);
                playerVersion[1] = parseInt(d.replace(/^.*\.(.*)\s.*$/, '$1'), 10);
                playerVersion[2] = /[a-zA-Z]/.test(d) ? parseInt(d.replace(/^.*[a-zA-Z]+(.*)$/, '$1'), 10) : 0;
            }
        }
        else if (typeof (window.ActiveXObject) != 'undefined') {
            try {
                var a = new ActiveXObject('ShockwaveFlash.ShockwaveFlash');

                if (a) { // a will return null when ActiveX is disabled
                    d = a.GetVariable('$version');

                    if (d) {
                        d = d.split(' ')[1].split(',');
                        playerVersion = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
                    }
                }
            }
            catch (e) { }
        }

        return playerVersion;
    },

    events:
        {
            cache: [],

            onData: function (aData, aResponse) {

                var body = aResponse.body ? aResponse.body : geewa.encodeJSON(aData);

                if (fe.flash._status < 2) {
                    if (aData.events && fe.getFirstFromArray(aData.events, 'type', 100))
                        this.toCache(aData.rid, body);
                }
                else {
                    var body = aResponse.body ? aResponse.body : geewa.encodeJSON(aData);
                    this.toFlash(aData.rid, body);
                }
            },

            toCache: function (rid, body) {
                this.cache[rid] = body;
            },

            flushCache: function () {
                if (this.cache.length === 0)
                    return;

                for (var rid in this.cache) {
                    var body = this.cache[rid];
                    
                    if (body)
                    {
                        this.toFlash(rid, body);
                    }
                }

                this.cache = [];
            },

            toFlash: function (aRid, aBody) {
                try {
                    if (this._ridSend > aRid) {
                        var p =
                        {
                            rid: aRid,
                            ridSend: this._ridSend,
                            ridConfirmed: this._ridConfirmed
                        };
                        if (this._startTime)
                            p.time = new Date().valueOf() - this._startTime;
                        fe.analytics.track('/events/error', p, true, true);
                    }
                    this._ridSend = aRid;
                    this._startTime = new Date().valueOf();
                    var flashGame = document.getElementById('__geewa_game_object');
                    var instance = this;
                    this._timerFrozen = setTimeout(function () { instance._onFrozen(aBody) }, 5000);
                    var x = flashGame.handleServerEvents(aBody);
                    //                if (x)
                    //                {
                    this._ridConfirmed = aRid;
                    geewa.debug.log('ajax->flash', 'fe.page.call:handleServerEvents', aBody);
                    //                }
                    //                else
                    //                    fe.analytics.track('/error/flash',{message: 'true is not returned!', method: 'handleServerEvents'}, true, true);
                }
                catch (e) {
                    geewa.debug.log('ajax->flash', 'fe.page.call:handleServerEvents not handled!\n' + e, aBody, 2);
                    var p =
                    {
                        message: e,
                        method: 'handleServerEvents',
                        arguments: [aBody],
                        flash: this.getFlashStatus()
                    };
                    fe.analytics.track('/error/flash', p, true, true);
                }
                clearTimeout(this._timerFrozen);
            },

            sendEvent: function (eventType, parameters) {
                if (this._gameDestroyed)
                    return;

                var obj = { eventType: eventType };

                if (parameters) {
                    for (var key in parameters)
                        obj[key] = parameters[key];
                }

                if (fe.flash._status < 2) {
                    this.toCache(eventType, obj);
                }

                if (!this.element)
                    this.element = document.getElementById('__geewa_game_object');

                try {
                    this.element.handleExternalEvent(obj);
                    geewa.debug.log('ajax->flash', 'fe.page.callEvent:' + eventType, geewa.encodeJSON(parameters));
                }
                catch (e) {
                    geewa.debug.log('ajax->flash', 'fe.page.callEvent:handleExternalEvent not handled!\n' + e, geewa.encodeJSON(obj), 2);
                    fe.analytics.track('/error/flash', { message: e, eventType: eventType, parameters: parameters }, true, true);
                }
            },

            _onFrozen: function (aBody) {
                clearTimeout(this._timerFrozen);
                var flashGame = document.getElementById('__geewa_game_object');
                var p =
                {
                    message: 'Call is frozen (longer then 5s)!',
                    method: 'handleServerEvents',
                    arguments: [aBody],
                    flash: this.getFlashStatus()
                };
                fe.analytics.track('/error/flash', p, true, true);
            },

            getFlashStatus: function () {

                var r = {};
                try {
                    r.__flash__addCallback = typeof (__flash__addCallback);
                    var flashGame = document.getElementById('__geewa_game_object');
                    r.flashGame = typeof (flashGame);
                    if (flashGame) {
                        r.CallFunction = typeof (flashGame.CallFunction);
                        r.handleServerEvents = typeof (flashGame.handleServerEvents);
                    }
                }
                catch (e) {
                    r.error = e;
                }
                return r;
            }
        }

};

/************************************************
/*
/*      AVATAR
/*
/************************************************/

fe.flash.avatar = 
    {
        imgIndex: navigator.userAgent.indexOf('MSIE') > -1 ? 0 : 1,

        onmouseover: function (/* element */) {
            if (window.event) {
                var e = window.event.fromElement;
                if (e == arguments[0] || e == arguments[0].lastChild.firstChild)
                    return;
                for (var i = 0; i < arguments[0].childNodes.length; i++)
                    if (arguments[0].childNodes[i] == e)
                        return;
            }
            this.start(arguments[0]);
        },

        onmouseout: function (/* element */) {
            if (window.event) {
                var e = window.event.toElement;
                if (e == arguments[0] || e == arguments[0].lastChild.firstChild)
                    return;
                for (var i = 0; i < arguments[0].childNodes.length; i++)
                    if (arguments[0].childNodes[i] == e)
                        return;
            }
            this.destroy();
        },

        _onClick: function (/*element*/) {
            if (this.onClick) {
                var u = this.user();
                this.onClick(u);
            }
        },

        start: function (/* element */) {
            if (this.element)
                this.destroy();
            var e = document.createElement('div');
            e.style.position = 'absolute';
            e.style.left = '-25px';
            e.style.top = '-25px';
            e.style.zIndex = 2;
            arguments[0].appendChild(e);

            var flashGameRoot = global.flashGameRoot.replace(/\{gameID\}/g, (fe.page.data.gameID == 'pool-3-dev' ? 'pool-3' : fe.page.data.gameID));
            var cacheKey = (geewa.debug.state === geewa.debug.DEBUG || global.debug ? new Date().valueOf() : geewa.loader.cacheKeys['avatarManager.1']);
            var subDir = (flashGameRoot.lastIndexOf('/dev/') == (flashGameRoot.length - 5) ? '' : fe.tryValue(fe.page, 'data.profile.custom.version') + '/');

            var p =
            {
                //neccessary for IE !!!!
                id: 'avatarViewer',
                url: global.flashApiRoot + 'avatar/AvatarViewerStandalone.swf?' + cacheKey,
                base: global.flashApiRoot + 'avatar/',
                width: 150,
                height: 125,
                wmode: 'transparent',
                flashvars:
                {
                    avatarUrl: flashGameRoot + subDir + 'avatar',
                    avatarCacheKey: cacheKey,
                    externalEventListener: '__geewa_avatar_onEvent'
                }
            };

            e.innerHTML = fe.flash.HTML(p);
            this.element = e;
            //geewa.debug.log('ajax','avatar.start', e.innerHTML);
        },

        destroy: function () {
            //geewa.debug.log('ajax','avatar.destroy');
            if (!this.element || this._timer)
                return;
            this.call('destroy');
            if (this.element.parentNode) {
                this.element.parentNode.childNodes[this.imgIndex].style.visibility = 'visible';
                this.element.parentNode.removeChild(this.element);
            }
            delete this.element;
        },

        call: function () {
            //geewa.debug.log('ajax','avatar.call ' + arguments[0]);
            if (!this.element)
                return null;
            try {
                var a = [];
                for (var i = 1; i < arguments.length; i++)
                    a.push(arguments[i]);
                return this.element.firstChild[arguments[0]].apply(this.element.firstChild, a);
            }
            catch (e) {
                return null;
            }
        },

        onEvent: function (aEvent) {
            //geewa.debug.log('ajax','avatar.onEvent ' + aEvent.eventType);
            try {
                switch (aEvent.eventType) {
                    case 'init':
                        var url = this.element.parentNode.getAttribute('data-image');
                        this.call('setAvatar', url);
                        break;

                    case 'updateComplete':
                        this.call('animate', 'hello (ch) (omg) (wha)');
                        this.element.parentNode.childNodes[this.imgIndex].style.visibility = 'hidden';
                        this.playSound();
                        break;

                    case 'animationStart':
                        break;

                    case 'animationProgress':
                        break;

                    case 'animationComplete':
                        break;

                    case 'mouseOut':
                        break;

                    case 'click':
                        this._onClick();
                        break;
                }
            }
            catch (e) {
            }
        },

        playSound: function () {
            //            if (session.sound === false)
            //                return;
            //            var counts =
            //            {
            //                'default':          1,
            //                'owner-generic':    1,
            //                'owner-custom':     1,
            //                'friend-better':    3,
            //                'friend-worse':     3
            //            }
            //            var user = this.user();
            //            var sound = this.element.parentNode.getAttribute('data-position');
            //            if (!sound)
            //                sound = 'default';
            //            else if (sound == 'owner')
            //                sound += (user.avatar.indexOf('defaultavatars') > -1 ? '-generic' :'-custom');
            //            sound += '-' + (user.gender === 2 ? 'f' : 'm') + (1 + Math.floor(Math.random()*counts[sound]));
            //            this.call('playSound', 'sound/en/' + sound + '.mp3');
        },

        user: function () {
            if (!this.element)
                return null;
            var x = this.element.parentNode.getAttribute('data-user');
            if (x)
                return eval('(' + x + ')');
            else {
                x = this.element.parentNode.getAttribute('data-position');
                if (x == 'owner')
                    return session.user;
                else
                    return null;
            }
        },

        getHTML: function (aUser, aAvatar/*, [style], [position]*/) {
            var o = [];
            var x = geewa.encodeJSON(aUser);
            x = x.replace(/"/g, '&quot;');
            o.push('<div class="avatar"');
            o.push(' data-user="' + x + '"');
            o.push(' data-image="' + aAvatar + '"');
            if (arguments.length > 2)
                o.push(' data-position="' + arguments[2] + '"');
            //guest
            if (aUser.type == 1)
                o.push('><div style="height: 100%; width: 100%; background: url(' + flashApiRoot + '/avatar/defaultAvatars/baby.png?a=mxz8kz2u%26v=3) no-repeat center center"></div>');
                //facebook picture
            else if (aAvatar && (aAvatar.indexOf('fbcdn.net') > -1 || aAvatar.indexOf('facebook.com') > -1))
                o.push('><div style="height: 100%; width: 100%; background: url(' + aAvatar + ') no-repeat center center" onclick="fe.avatar._onClick(this);"></div>');
                //geewa animated avatar
            else {
                if (arguments.length > 1 && arguments[1])
                    o.push(arguments[1]);
                if (navigator.userAgent.indexOf('MSIE') > -1)
                    o.push('" onmouseover="fe.flash.avatar.onmouseover(this);" onmouseout="fe.avatar.onmouseout(this);">');
                else
                    o.push('"><div style="position:absolute;width:100px;height:100px;z-index:99;" onmouseover="fe.flash.avatar.onmouseover(this.parentNode);" onmouseout="fe.flash.avatar.onmouseout(this.parentNode);" onclick="fe.flash.avatar._onClick(this);"></div>');
                o.push('<div style="position:absolute;width:100px;height:100px;background:url(' + aAvatar + ') no-repeat center -20px;"></div>');
            }
            o.push('</div>');
            return o.join('');
        }
    };
///<reference path="fe.js" />

fe.page = fe.page ? fe.page : {};

fe.page =
{
    id:             'game',
    matchActive:    false,
    _callID:        1,

    onLoad: function()
    {
        if (session.user.type > fe.USER_TYPE_GUEST)
            this.insertGame();
        else {
            fe.loader.destroy();

            var o = [];
            o.push('<div style="position: relative;">');
            o.push('<img src="' + global.staticWebRoot + 'img/only-for-registered.png" alt="" width="740" height="640" />');
            o.push('<div class="play-only-registered">');
            o.push('<div style="font-size: 200%;">' + l.gl('facebookApp.poker-3.onlyForRegistered.title') + '</div>');
            o.push('<div style="margin-top: 10px;">');
            o.push(l.replaceTokens(l.gl('facebookApp.poker-3.onlyForRegistered.text'), '<a href="javascript:void(0);" onclick="geewa.app.call(\'showLogin\');">', '</a>', '<a href="javascript:void(0);" onclick="geewa.app.call(\'showSignUp\');">', '</a>'));
            o.push('</div>');
            o.push('</div>');
            o.push('</div>');

            var e = document.getElementById('gameBody');
            e.innerHTML = o.join('');

            geewa.app.setHash('overview');
        }
    },

    onResize: function()
    {
        if (arguments.length > 0)
            this._size = arguments[0];
        if (!this._size)
            return;
        var e = fe.getIDs('__geewa_game_object');
        if (!e[0])
            return;
        var p = this._size;
        var g =
        {
            width: 740,
            height: 640,
            fullHeight: 834
        };
        switch (p.mode)
        {
            //to fix standard size
            case 1:
                e[0].width = g.width;
                e[0].height = g.fullHeight;
                break;

            //to dynamic fullscreen mode
            case 2:
                var scrollTo = 52; //height of tabs
                var width, height;

                if (p.width < g.width || p.height < g.height)
                {
                    width = g.width;
                    height = g.fullHeight;
                }
                else if (p.width / p.height > g.width / g.height)
                {
                    width = p.height * g.width / g.height;
                    height = width * g.fullHeight / g.width;
                }
                else
                {
                    width = p.width;
                    height = p.width * g.fullHeight / g.width;
                }

                e[0].width = width;
                e[0].height = height;
                break;
        }

        if (scrollTo)
            geewa.app.fixPageHeight(scrollTo);
        else
            geewa.app.fixPageHeight();
    },

    onEventServer: function(aData, aResponse)
    {
        if (aData.events)
        {
            for (var i = 0; i < aData.events.length; i++)
            {
                if (aData.events[i].type == 100 || aData.events[i].type == 101)
                {
                    if (aData.events[i].type == 100)
                    {
                        if (aData.events[i].data.activityID != this.activity.activityID)
                        {
                            aData.events[i].splice(i, 1);
                            i--;
                            continue;
                        }

                        this.userActivity = aData.events[i].data;
                    }
                    else
                    {
                        if (aData.events[i].data.userActivity.activityID != this.activity.activityID)
                        {
                            aData.events[i].splice(i, 1);
                            i--;
                            continue;
                        }

                        if (this.userActivity)
                        {
                            for (var key in aData.events[i].data.userActivity)
                                this.userActivity[key] = aData.events[i].data.userActivity[key];
                        }
                        else
                            this.userActivity = aData.events[i].data.userActivity;
                    }

                    if (fe.page.profile._page == 'userTransactions')
                        fe.page.profile.showUserTransactions();
                    break;
                }
            }
        }

        fe.flash.events.onData(aData, aResponse);
    },

    hashChange: function(aPage)
    {
        var pages = ['game', 'transactions'];

        for (var i = 0; i < pages.length; i++)
        {
            var e = document.getElementById(pages[i] + 'Page');

            if (e)
            {
                e.style.height = '0';
                e.style.width = '0';
            }
        }

        var e = document.getElementById(aPage + 'Page');

        if (e)
        {
            e.style.height = '';
            e.style.width = '';
        }

        switch (aPage)
        {
            case 'game':
                geewa.app.fixPageHeight();
                this.onResize();
                break;

            case 'transactions':
                fe.page.profile.show();
                geewa.app.fixPageHeight();
                break;
        }
    },

    insertGame: function()
    {
        delete this.element;

        var fv =
        {
            gameID:                 fe.page.data.gameID,
            language:               l.id,
            externalEventListener:  '__geewa_onEvent',
            publicServerURL:        global.publicServer,
            publicServer:           [{ url: global.publicServer }],
            pageLoadStartTime:      window.pageLoadStartTime,
            pageUrl:                global.geewaAppUrl
        };

        if (global['kontagent.enabled'])
        {
            fv.kontagentAPIKey = global['kontagent.eventsApiKey'];

            if (global['kontagent.eventsSuffix'])
                fv.kontagentEventsSuffix = global['kontagent.eventsSuffix'];
        }

        if (window != top)
            fv.advert = 'preroll|postroll';
        if (this.invite)
        {
            fv.acceptInvitationToRoom = this.invite;
            delete this.invite;
        }
        if (geewa.debug.state === geewa.debug.DEBUG)
        {
            fv.debugMode = true;
        }
        if (session)
            fv.userServerSessionID = session.sessionID;
        fv.userServerURL = session.serverUrls.user;
        fv.userServer = session.userServer;
        fv.connectToEventServer = false;

        for (var id in arguments[0])
            fv[id] = arguments[0][id];

        var flashGameRoot = global.flashGameRoot.replace(/\{gameID\}/g, 'poker-3');
        var cacheKey = (geewa.debug.state === geewa.debug.DEBUG || global.debug ? new Date().valueOf() : fe.tryValue(fe.page, 'data.profile.custom.cacheKey', new Date().valueOf()));
        var subDir = fe.page.flashVersionConfig.main + '/';

        fv.cacheKey = cacheKey;

        var p =
        {
            //neccessary for IE !!!!
            id:             '__geewa_game_object',
            url:            flashGameRoot + subDir + 'PiratePoker.swf?cacheKey=' + cacheKey,
            base:           flashGameRoot + subDir,
            width:          740,
            height:         834,
            wmode:          'opaque',
            flashvars:      fv
        };

        var e = document.getElementById('gameBody');
        fe.flash._status = 1;

        e.innerHTML = fe.flash.HTML(p);
        fe.loader.message(l.gl('facebookApp.loader.loading'), 3, true);

        geewa.app.fixPageHeight();
    },

    callGame: function()
    {
        if (!this.element)
            this.element = document.getElementById('__geewa_game_object');
        var a = [];
        for (var i = 1; i < arguments.length; i++)
            a.push(arguments[i]);
        if (!this.element || fe.flash._status < 2)
        {
            var that = this;
            var args = arguments;
            this._onConnectThunks.push(function() { fe.page.callGame.apply(that, args); });

            geewa.debug.log('ajax->flash', 'fe.page.call:' + arguments[0] + ' not handled because game not exist!', geewa.encodeJSON(a), 2);
            return;
        }
        var instance = this.element;
        var method = arguments[0];
//        setTimeout(
//            function()
//            {
                try
                {
                    instance[method].apply(instance, a);
                    geewa.debug.log('ajax->flash', 'fe.page.call:' + method, geewa.encodeJSON(a));
                }
                catch (e)
                {
                    geewa.debug.log('ajax->flash', 'fe.page.call:' + method + ' not handled!\n' + e, geewa.encodeJSON(a), 2);
                    fe.analytics.track('/error/flash', {message: e, method: method, arguments: a}, true, true);
                }
//            }, 0);
    },

    callEvent: function(eventType, parameters)
    {
        if (!this.element)
            this.element = document.getElementById('__geewa_game_object');        

        if (!this.element || fe.flash._status < 2)
        {
            var that = this;
            var args = arguments;
            this._onConnectThunks.push(function() { fe.page.callEvent.apply(that, args); });

            geewa.debug.log('ajax->flash', 'fe.page.callEvent:' + eventType + ' not handled because game not exist!', geewa.encodeJSON(parameters), 2);
            return;
        }

        var obj = { eventType: eventType };

        if (parameters)
        {
            for (var key in parameters)
                obj[key] = parameters[key];
        }

        //var instance = this.element;
        try
        {
            this.element.handleExternalEvent(obj);
            //instance['handleExternalEvent'].apply(instance, obj);
            geewa.debug.log('ajax->flash', 'fe.page.callEvent:' + eventType, geewa.encodeJSON(parameters));
        }
        catch (e)
        {
            geewa.debug.log('ajax->flash', 'fe.page.callEvent:handleExternalEvent not handled!\n' + e, geewa.encodeJSON(obj), 2);
            fe.analytics.track('/error/flash', {message: e, eventType: eventType, parameters: parameters}, true, true);
        }
    },

    onEvent: function()
    {
        var event = arguments[0];
        geewa.debug.log('flash->ajax', 'fe.page.onEvent: ' + event.eventType, geewa.encodeJSON(event));
        switch (event.eventType)
        {
            case 'init':
                this._gameVersion = event.version;
                fe.flash._status = 2;
                this.events.flushCache();
                fe.analytics.track('/init-game', null, false);
                break;

            case 'connect':
                fe.flash._status = 3;
                fe.analytics.track('/load-game', {version:this._gameVersion});

                //stop preloader
                fe.loader.destroy();

                for (var i = 0; i < this._onConnectThunks.length; i++)
                    this._onConnectThunks[i]();
                break;

            case 'mpMatchStart':
                if (geewa.server.event.setHeaderTimeout)
                    geewa.server.event.setHeaderTimeout(5);
                break;

            case 'lobbyCanceled':
            case 'mpMatchEnd':
            case 'giveUp':
                if (geewa.server.event.setHeaderTimeout)
                    geewa.server.event.setHeaderTimeout(20);
                break;

            case 'share':
                fe.page.publish.share(event);
                break;

            case 'addCoins':
                geewa.app.call('showPayment', 'poker_coins', l.gl('payment.poker_coins.title'));
                break;

            case 'advertPause':
                //event.advertType preroll, postroll
                geewa.app.call('showAd', event.advertType);
                break;

            case 'trackView':
                fe.analytics.track(event.code, event.parameters, event.trackGA, event.trackFromNow);
                break;

            case 'analytics':
                var code = '';

                if (event.subtype1)
                {
                    code += '/' + event.subtype1;

                    if (event.subtype2)
                    {
                        code += '/' + event.subtype2;

                        if (event.subtype3)
                            code += '/' + event.subtype3;
                    }
                }

                code += '/' + event.eventName;

                fe.analytics.track(code, { value: event.value, level: event.level, data: event.data }, true, false);
                break;

            case 'invite':
                this.gameData = this.gameData || {};
                this.gameData.lobbyID = event.roomID;
                var o = [];
                o.push(l.gl('facebookApp.poker-3.playWithFriend.copyLink'));
                this.dialogInviteUrl(l.gl('facebookApp.poker-3.playWithFriend.copyLink_title'), o.join(''));
                break;

            case 'getCurrency':
                var currency;

                switch (geewa.tryValue(session, 'user.location.alpha3'))
                {
                    case 'AUS':
                        currency = 'AUD';
                        break;

                    //Bosnia and Herzegovina
                    case 'BIH':
                        currency = 'BAM';
                        break;

                    case 'CAN':
                        currency = 'CAD';
                        break;

                    case 'CZE':
                        currency = 'CZK';
                        break;

                    //Croatia
                    case 'HRV':
                        currency = 'HRK';
                        break;

                    case 'BEL':
                    case 'EST':
                    case 'FIN':
                    case 'IRL':
                    case 'CYP':
                    case 'LUX':
                    case 'MLT':
                    case 'NLD':
                    case 'PRT':
                    case 'GRC':
                    case 'SVN':
                    case 'AUT':
                    case 'DEU':
                    case 'FRA':
                    case 'ESP':
                    case 'ITA':
                    case 'SVK':
                        currency = 'EUR';
                        break;

                    case 'GBR':
                        currency = 'GBP';
                        break;

                    case 'SRB':
                        currency = 'RSD';
                        break;

                    default:
                        currency = 'USD';
                        break;
                }

                fe.page.callEvent('getCurrencyCompleted', { currency: currency });
                break;

            case 'buyProduct':
                geewa.app.call('showPaymentProduct', { activityID: 'poker-3', productGroup: event.productGroup, productID: event.productID, currency: event.currency });
                break;

            case 'reload':
                fe.showOverlay(event.reason);
                break;

            default:
                //alert(event.eventType + '\n' + geewa.encodeJSON(event));
                break;
        }
    },

    dialogInviteUrl: function(aTitle, aBody)
    {
        var o = [];
        o.push('<div style="width:500px;">');
        o.push('<img src="' + global.staticWebRoot + 'img/invite.png" alt="" /> ');
        o.push(aBody);

        var url = global.geewaAppUrl + '?invite=' + this.gameData.lobbyID + '&utm_source=url-invite';
        var bCopy = (typeof(clipboardData) != 'undefined' && clipboardData.setData);
        o.push('<br/><br/><input id="invitatitonUrl" type="text" value="' + url + '" onclick="this.select();" style="width: ' + (bCopy?80:98) + '%;"/>');
        if (bCopy)
            o.push(' <input id="embed-button" type="button" value="Copy" onclick="clipboardData.setData(\'Text\',\'' + url + '\');"/>');

        o.push('</div>');

        var p =
        {
            title:      aTitle,
            body:       o.join(''),
            buttons:    '<input type="button" value="' + l.gl('game.close') + '" onclick="fe.popup.close();" class="inputaux"/>'
        };
		geewa.app.call('showPopup', p);

        fe.analytics.track('/inviteFriend/url');
        //TODO: crossdomain problem
        //document.getElementById('invitatitonUrl').select();
    },

    goToLevel: function(levelID)
    {
        if (!this.matchActive)
            this.callGame('goToLevel', levelID);
    },

    /************************************************

          PROFILE TAB

    ************************************************/

    profile:
    {
        _page: null,
        _countries: [],

        show: function()
        {
            if (session.user.type < fe.USER_TYPE_USER)
            {
                geewa.app.setHash('overview');
                return;
            }

            if (!this._page)
                this._page = 'userTransactions';

            switch (this._page)
            {
                case 'userTransactions':
                    this.showUserTransactions();
                    break;
            }
        },

        showUserTransactions: function()
        {
            this._page = 'userTransactions';
            this.setActiveLink('userTransactionsLink');

            var e = fe.getIDs('transactionsPageContent');
            e[0].innerHTML = '<p><img src="../img/loader.gif" alt="Loading..." /></p>';

            var instance = this;
            geewa.server.user.call(function(){instance.onGetTransactions.apply(instance,arguments);}, 'Activity.GetTransactions', fe.page.activity.activityID, l.id, 0, 10000, null);
        },

        onGetTransactions: function(request, response)
        {
            var o = [];
            var e = fe.getIDs('transactionsPageContent');
            if (!response.error && response.result && response.result.items)
            {
                var items = response.result.items;
                o.push('<div class="user-transactions">');

                var i = 0;

                if (!items[i].closed)
                {
                    var value = null;
                    var valueType;

                    if (items[i].actionID == 'payment_product')
                    {
                        value = items[i].data.price * -1;
                        valueType = (global.theme == 'h' ? 'zlataky' : 'gcash');
                    }
                    else if (typeof(items[i].cashChange) == 'number' && items[i].cashChange != 0)
                    {
                        value = items[i].cashChange;
                        valueType = 'gold';
                    }
                    else if (typeof(items[i].coinsChange) == 'number' && items[i].coinsChange != 0)
                    {
                        value = items[i].coinsChange;
                        valueType = 'doubloons';
                    }
                    else if (items[i].productID)
                    {
                        value = 0;
                        valueType = '';
                    }

                    if (value != null)
                    {
                        var valueString = (value != 0 ? ((value > 0 ? '+' : '') + fe.numFormat(value)) : '');

                        o.push('<h3>' + l.gl('facebookApp.poker-3.profile.currentGame') + '</h3>');
                        o.push('<table border="1">');
                        o.push('<tr>');
                        o.push('<th style="width: 5%;">&nbsp;</th>');
                        o.push('<th style="width: 10%;">&nbsp;</th>');
                        o.push('<th style="width: 65%;">' + l.gl('facebookApp.poker-3.profile.message') + '</th>');
                        o.push('<th style="width: 20%;">' + l.gl('facebookApp.poker-3.profile.time') + '</th>');
                        o.push('</tr>');
                        o.push('<tr class="even">');
                        o.push('<td style="text-align: center;"><img src="../img/pixel.gif" class="' + valueType + '" /></td>');
                        o.push('<td style="text-align: right;"><span style="font-weight: bold;color: #999;">' + valueString + '</span></td>');
                        o.push('<td>' + items[i].message + '</td>');
                        o.push('<td style="white-space: nowrap;" title="' + this.getDateString(items[i].createTime) + '">' + fe.timeBefore(items[i].createTime) + '</td>');
                        o.push('</tr>');
                        o.push('</table>');

                        i = 1;
                    }
                }

                o.push('<h3>' + l.gl('facebookApp.poker-3.profile.tabs.history') + '</h3>');
                o.push('<table border="1">');
                o.push('<tr>');
                o.push('<th style="width: 5%;">&nbsp;</th>');
                o.push('<th style="width: 10%;">&nbsp;</th>');
                o.push('<th style="width: 65%;">' + l.gl('facebookApp.poker-3.profile.message') + '</th>');
                o.push('<th style="width: 20%;">' + l.gl('facebookApp.poker-3.profile.time') + '</th>');
                o.push('</tr>');

                for (; i < items.length; i++)
                {
                    if (items[i].coinsChange == 0 && items[i].actionID == 'bet')
                        continue;

                    var value = null;
                    var valueType;

                    if (items[i].actionID == 'payment_product')
                    {
                        value = items[i].data.price * -1;
                        valueType = (global.theme == 'h' ? 'zlataky' : 'gcash');
                    }
                    else if (typeof(items[i].cashChange) == 'number' && items[i].cashChange != 0)
                    {
                        value = items[i].cashChange;
                        valueType = 'gold';
                    }
                    else if (typeof(items[i].coinsChange) == 'number' && items[i].coinsChange != 0)
                    {
                        value = items[i].coinsChange;
                        valueType = 'doubloons';
                    }
                    else if (items[i].productID)
                    {
                        value = 0;
                        valueType = '';
                    }

                    if (value != null)
                    {
                        var valueString = (value != 0 ? ((value > 0 ? '+' : '') + fe.numFormat(value)) : '');

                        if (items[i].closed)
                        {
                            var message = items[i].message;

                            if (items[i].coinsChange > 0 && valueType == 'gold')
                                message += ' <img src="../img/pixel.gif" class="doubloons" /> <span style="font-weight:bold;color:green">+' + fe.numFormat(items[i].coinsChange) + '</span>';

                            o.push('<tr' + (i % 2 ? ' class="even"' : '') + '>');
                            o.push('<td style="text-align: center;"><img src="../img/pixel.gif" class="' + valueType + '" /></td>');
                            o.push('<td style="text-align: right;"><span style="font-weight: bold;color:' + (value < 0 ? 'red' : 'green') + ';">' + valueString + '</span></td>');
                            o.push('<td>' + message + '</td>');
                            o.push('<td style="white-space: nowrap;" title="' + this.getDateString(items[i].createTime) + '">' + fe.timeBefore(items[i].createTime) + '</td>');
                            o.push('</tr>');
                        }
                        else
                        {
                            o.push('<tr' + (i % 2 ? ' class="even"' : '') + ' style="color: #999;">');
                            o.push('<td style="text-align: center;"><img src="../img/pixel.gif" class="' + valueType + '" /></td>');
                            o.push('<td style="text-align: right;"><span style="font-weight: bold;">' + valueString + '</span></td>');
                            o.push('<td>' + items[i].message + '</td>');
                            o.push('<td style="white-space: nowrap;" title="' + this.getDateString(items[i].createTime) + '">' + fe.timeBefore(items[i].createTime) + '</td>');
                            o.push('</tr>');
                        }
                    }
                }

                o.push('</table></div>');
            }
            e[0].innerHTML = o.join('');
            geewa.app.fixPageHeight();
            fe.analytics.track('/profile/transactions');
        },

        setActiveLink: function(activeLinkID)
        {
            var e = fe.getIDs('userProfileLink','userTransactionsLink','avatarEditorLink');

            for (var i = 0; i < e.length; i++)
                if (e[i])
                    e[i].className = (e[i].id == activeLinkID ? 'active' : '');
        },

        getDateString: function(time)
        {
            var createTime = new Date(time);
            var minutes = createTime.getMinutes();
            if (minutes < 10)
                minutes = '0' + minutes;
            return createTime.toLocaleDateString() + ' ' + createTime.getHours() + ':' + minutes;
        }
    },

    /************************************************
    /*
    /*      PUBLISH
    /*
    /************************************************/

    publish:
    {
        share: function(event)
        {
            var instance = this;
            var url = this.addStats(global.geewaAppUrl, event.code);

            var p =
            {
                method:         'feed',
                name:           event.name,
                link:           url,
                description:    event.description,
                picture:        event.imageURL,
                source:         event.source,
                caption:        ' ',
                actions:        [{ name: l.gl('facebookApp.poker-3.share.link'), link: url }],
                subtype1:       event.subtype1,
                subtype2:       event.subtype2,
                subtype3:       event.subtype3
            };

            if (global.shareInPopup)
                p.display = 'popup';

            geewa.app.call('FB.ui', p);
        },

        addStats: function(url, type)
        {
            url += (url.indexOf('?') > -1 ? '&' : '?');
            url += 'utm_source=' + type;

            return url;
        }
    }
}

function __geewa_onEvent()
{
    var a = arguments;
    fe.page.onEvent.apply(fe.page, a);

    return (new Date().valueOf() - window.pageLoadStartTime);
}
