/**
 * @name ContentFlooder
 * @description Forces images upon you.
 * @version 1.0.0
 * @author deepslice
 * @authorId 849564083724091412
 * @website https://github.com/dfaker/ContentFlooder/tree/master/
 * @source https://github.com/dfaker/ContentFlooder/tree/master/
 */
/*@cc_on
@if (@_jscript)
    
    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

    @else@*/
    const config = {
        info: {
            name: "ContentFlooder",
            authors: [
            {
                name: "deepslice",
                discord_id: "849564083724091412",
                github_username: "deepslice"
            }
            ],
            version: "1.0.0",
            description: "Forces images upon you.",
            github: "https://github.com/dfaker/ContentFlooder/tree/master/",
            github_raw: "https://raw.githubusercontent.com/dfaker/ContentFlooder/master/ContentFlooder.plugin.js"
        },
        changelog: [
        ],
        defaultConfig: [

            {
                type: "switch",
                id: "captureImages",
                name: "Capture Posted Images",
                note: "Capture and process posted images.",
                value: true
            },

            {
                type: "switch",
                id: "captureVideos",
                name: "Capture Posted Videos",
                note: "Capture and process posted videos.",
                value: true
            },

        ],
        main: "index.js"
    };
    class Dummy {
        constructor() {this._config = config;}
        start() {}
        stop() {}
    }

    if (!global.ZeresPluginLibrary) {
        BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.name ?? config.info.name} is missing. Please click Download Now to install it.`, {
            confirmText: "Download Now",
            cancelText: "Cancel",
            onConfirm: () => {
                require("request").get("https://betterdiscord.app/gh-redirect?id=9", async (err, resp, body) => {
                    if (err) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                    if (resp.statusCode === 302) {
                        require("request").get(resp.headers.location, async (error, response, content) => {
                            if (error) return require("electron").shell.openExternal("https://betterdiscord.app/Download?id=9");
                            await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), content, r));
                        });
                    }
                    else {
                        await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0PluginLibrary.plugin.js"), body, r));
                    }
                });
            }
        });
    }

    module.exports = !global.ZeresPluginLibrary ? Dummy : (([Plugin, Api]) => {
     const plugin = (Plugin, Api) => {
        const {ContextMenu, DOM, Webpack, Patcher} = window.BdApi;

        const SelectedChannelStore = Webpack.getModule(m => m.getCurrentlySelectedChannelId);
        const ChannelStore = Webpack.getModule(m => m.getDMFromUserId);
        const InlineMediaWrapper = Webpack.getModule(m => m.toString().includes("renderAccessory"));
        const WrapperClasses = Webpack.getModule(m => m.wrapperPlaying);
        const Events = require("events");
        const Dispatcher = new Events();

        const formatString = (string, values) => {
            for (const val in values) {
                let replacement = values[val];
                if (Array.isArray(replacement)) replacement = JSON.stringify(replacement);
                if (typeof(replacement) === "object" && replacement !== null) replacement = replacement.toString();
                string = string.replace(new RegExp(`{{${val}}}`, "g"), replacement);
            }
            return string;
        };

        /* globals BdApi:false */
        return class FloodMedia extends Plugin {
            constructor(meta) {
                super();
                this.meta = meta;
                this.panes = {};

                this.currentChannel=null;

                this.chache = {}
                this.cacheseen = {}
                this.cacheoffset=0;
                this.maximumplayingvideos = 3

                this.paneindex = 0;
                this.autoInterval=null;
                this.volume=0;
                this.fullscreen = false;
                this.styleTemplate = `
                .opacityElemFlood{opacity:0.2;} 
                .opacityElemFlood:hover{opacity:1.0;} 
                .opacityLowElemFlood{opacity:0.5;} 
                .opacityLowElemFlood:hover{opacity:1.0;}
                .opacityLowElemFlood:hover{opacity:1.0;}

                .zoom-in-out-box {
                  animation: zoom-in-zoom-out 1s ease infinite;
              }

              @keyframes zoom-in-zoom-out {
                  0% {
                    transform: scale(0.2, 0.2);
                }
                25% {
                    transform: scale(1.0, 1.0);
                }
                50% {
                    transform: scale(1.0, 1.0);
                }
                75% {
                    transform: scale(1.0, 1.0);
                }
                100% {
                    transform: scale(0.2, 0.2);
                }
            }

            `;

            this.channelChange = this.channelChange.bind(this);

            this.advance = this.advance.bind(this);
            this.bigWheel = this.bigWheel.bind(this);


            this.isFullscreenMode = function(){return this.fullscreen};

        }

        isFullscreenMode(){
            return this.fullscreen
        }

        onStart() {
            /** @type {Set<string>} */
            this.floodedChannels = new Set(BdApi.loadData(this.meta.name, "floodModeOn") ?? []);

            /** @type {Set<string>} */
            this.lowOpacityChannels = new Set(BdApi.loadData(this.meta.name, "opacityModeOn") ?? []);

            /** @type {Set<string>} */
            this.bgOverrideChannels = new Set(BdApi.loadData(this.meta.name, "backgroundOverrideModeOn") ?? []);

            /** @type {Set<string>} */
            this.seenChannels = new Set(BdApi.loadData(this.meta.name, "seen") ?? []);

            this.chache = (BdApi.loadData(this.meta.name, "postCache") ?? {});

            this.debouncedupdatevideoGridOffset = _.debounce(this.updatevideoGridOffset,100,{'leading': true})

            this.addStyle();

            let fspane = document.getElementById('fsfullscreencontentflooder')

            if(!fspane){
                fspane = document.createElement("div");
                fspane.id="fsfullscreencontentflooder"
                fspane.style.position='absolute'
                fspane.style.position='absolute'
                fspane.style.background='black'

                fspane.style.width='100%'
                fspane.style.height='100%'
                fspane.style.top='0'
                fspane.style.paddingtop='0'
                fspane.style.zIndex='999'
                fspane.style.display='none'
                fspane.style.paddingTop='20px'

                fspane.autoplay=true
                fspane.loop=true
                fspane.volume=0
                document.body.appendChild(fspane)

                fspane.addEventListener("wheel", (e) => { this.debouncedupdatevideoGridOffset(e) });

                let bigplayer = document.createElement("video");
                bigplayer.id="fsvideowrappercontentflooderbigplayer"
                bigplayer.style.position='fixed'
                bigplayer.style.top='20px'
                bigplayer.style.left='0px'
                bigplayer.style.width='100%'
                bigplayer.style.height='100%'
                bigplayer.style.display = 'none'
                bigplayer.style.backgroundColor = 'rgba(0,0,0,0.5);'
                bigplayer.style.zIndex='999'
                bigplayer.autoplay=true
                bigplayer.loop=true
                bigplayer.volume=0       

                bigplayer.style.backgroundSize='contain'
                bigplayer.style.backgroundRepeatX='no-repeat'
                bigplayer.style.backgroundRepeatY='no-repeat'
                bigplayer.style.backgroundPosition='center center';
                bigplayer.addEventListener("click", (e) => { this.bigplayerhide(e) } )
                bigplayer.addEventListener("wheel", this.bigWheel);

                document.body.appendChild(bigplayer)

                let fspaneoptx = document.createElement("select");
                fspaneoptx.id='fspaneoptselectx'
                fspaneoptx.className = 'opacityLowElemFlood'
                fspaneoptx.style.position='fixed'
                fspaneoptx.style.top='20px'
                fspaneoptx.style.left='0px'
                fspaneoptx.style.zIndex='999999'
                fspaneoptx.onchange= (e) => { this.optionChange() }
                fspane.appendChild(fspaneoptx)

                let fspaneopty = document.createElement("select");
                fspaneopty.id='fspaneoptselecty'
                fspaneopty.className = 'opacityLowElemFlood'
                fspaneopty.style.position='fixed'
                fspaneopty.style.top='20px'
                fspaneopty.style.left='70px'
                fspaneopty.style.zIndex='999999'
                fspaneopty.onchange= (e) => { this.optionChange() }
                fspane.appendChild(fspaneopty)


                let fspaneoptvol = document.createElement("select");
                fspaneoptvol.id='fspaneoptselectvol'
                fspaneoptvol.className = 'opacityLowElemFlood'
                fspaneoptvol.style.position='fixed'
                fspaneoptvol.style.top='20px'
                fspaneoptvol.style.left='145px'
                fspaneoptvol.style.zIndex='999999'
                fspaneoptvol.onchange= (e) => { this.volChange() }
                fspane.appendChild(fspaneoptvol)

                let optautoadvance = document.createElement("select");
                optautoadvance.id='fspaneoptselectauto'
                optautoadvance.className = 'opacityLowElemFlood'
                optautoadvance.style.position='fixed'
                optautoadvance.style.top='20px'
                optautoadvance.style.right='0px'
                optautoadvance.style.zIndex='999999'
                optautoadvance.onchange= (e) => { this.advChange() }
                fspane.appendChild(optautoadvance)



                let optmaxvideos = document.createElement("select");
                optmaxvideos.id='fspaneoptmaxVideos'
                optmaxvideos.className = 'opacityLowElemFlood'
                optmaxvideos.style.position='fixed'
                optmaxvideos.style.top='20px'
                optmaxvideos.style.right='76px'
                optmaxvideos.style.zIndex='999999'
                optmaxvideos.onchange= (e) => { this.maxvidsChange() }
                fspane.appendChild(optmaxvideos)


                let optoffmaxvid = document.createElement("option");
                optoffmaxvid.text= 'no max playing limit'
                optoffmaxvid.value= 'no max playing limit'
                optmaxvideos.appendChild(optoffmaxvid)


                for(let d=0;d<=100;d+=5){

                    let opt1 = document.createElement("option");
                    opt1.text= 'vol '+d+''
                    opt1.value= 'vol '+d+''
                    fspaneoptvol.appendChild(opt1)    

                }


                let optoff = document.createElement("option");
                optoff.text= 'auto off'
                optoff.value= 'auto off'
                optautoadvance.appendChild(optoff)


                for(let d=1;d<10;d+=2){

                    let opt3 = document.createElement("option");
                    opt3.text= (d/10.0)+' sec'
                    opt3.value= (d/10.0)+' sec'

                    optautoadvance.appendChild(opt3)

                }


                for(let d=1;d<20;d++){

                    let opt1 = document.createElement("option");
                    opt1.text= d+' cols'
                    opt1.value= d+' cols'


                    let maxvid = document.createElement("option");
                    maxvid.text= d+' max playing'
                    maxvid.value= d+' max playing'
                    if(d==3){
                        maxvid.selected = true;
                    }
                    optmaxvideos.appendChild(maxvid)


                    let opt2 = document.createElement("option");
                    opt2.text= d+' rows'
                    opt2.value= d+' rows'

                    if(d==4){
                        opt1.selected = true;
                        opt2.selected = true;
                    }

                    fspaneoptx.appendChild(opt1)
                    fspaneopty.appendChild(opt2)
                    if(d>1){
                        let opt3 = document.createElement("option");
                        opt3.text= d-1+' sec'
                        opt3.value= d-1+' sec'
                        optautoadvance.appendChild(opt3)
                    }
                }

                fspane.appendChild(fspaneoptx)
                fspane.appendChild(fspaneopty)
                this.optionChange()

            }


            Patcher.after(this.meta.name, InlineMediaWrapper.prototype, "render", (thisObject, _, retVal) => {
                const channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());
                if (!this.isFlooding(channel)) return;

                if (this.isLowOpacity(channel)){
                    if (retVal.props.className) retVal.props.className = retVal.props.className + " opacityElemFlood";
                    else retVal.props.className = "opacityElemFlood";                    
                }                

                let wrapper = null;
                if(this.isFullscreenMode()){
                    wrapper = document.getElementById('fsfullscreencontentflooder');
                }else{
                    let divs = document.getElementsByTagName('ol');
                    let di = 0;
                    for(di in divs){
                        if(divs[di].className && divs[di].className.indexOf('scrollerInner') > -1){
                            wrapper = divs[di];
                            break
                        }
                    }
                }

                let gridElements = document.getElementsByClassName('cfgridcell') 



                if(wrapper){


                    let vids = document.getElementsByClassName('fsvideowrappercontentflooder')
                    let vid  = null;

                    if(vids.length > 0){
                        vid = vids[0];  
                    }else{
                        vid = document.createElement("video");
                        vid.className="fsvideowrappercontentflooder"

                        vid.style.position = 'fixed';
                        vid.style.top = '111px';
                        vid.style.bottom = '0px';
                        vid.style.left = '323px';
                        vid.style.right = '68px';
                        vid.style.width = '77%';
                        vid.style.height = '86%';

                        vid.style.zIndex='-1'
                        vid.autoplay=true
                        vid.loop=true
                        vid.volume=0                    
                        wrapper.appendChild(vid)
                    }


                    if(this.isFullscreenMode()){
                        wrapper = gridElements[this.paneindex%gridElements.length]
                        vid     = gridElements[this.paneindex%gridElements.length]
                        this.paneindex++
                    }

                    let seen = [];
                    let nextsrc = null
                    let ctxm = null;
                    let thumb = null;
                    let srctype    = 'video'
                    if(this.isFullscreenMode()){
                        let vi = 0;
                        for(vi in gridElements){
                            if(gridElements[vi]){
                                seen.push(gridElements[vi].src)
                                if(gridElements[vi].style){
                                    seen.push(gridElements[vi].style.backgroundImage)  
                                }
                            }                          
                        }
                    }else{
                        seen.push(vid.src)
                        seen.push(vid.style.backgroundImage)
                    }


                    if (this.settings.captureVideos && retVal.props.src && retVal.props.src.match(/(\.webm\?|\.mov\?|\.mp4\?)/)) {
                        let parts = retVal.props.src.split('?')
                        if(seen.indexOf(parts[0])==-1){
                            nextsrc = parts[0]
                            thumb = 'url("'+retVal.props.src+'")'
                            ctxm = retVal.props.onContextMenu
                            srctype    = 'video'
                        }
                    }else if (this.settings.captureVideos && retVal.props.src && retVal.props.src.match(/(webm|mov|mp4)$/)) {
                        if(seen.indexOf(retVal.props.src)==-1){
                            nextsrc = retVal.props.src
                            ctxm = retVal.props.onContextMenu
                            srctype    = 'video'
                        }                
                    }else if (this.settings.captureVideos && retVal.props.original && retVal.props.original.match(/(webm|mov|mp4)$/)) {
                        if(seen.indexOf(retVal.props.original)==-1){
                            nextsrc = retVal.props.original
                            ctxm = retVal.props.onContextMenu
                            srctype    = 'video'
                        }
                    }else if (this.settings.captureImages && retVal.props.original && retVal.props.original.match(/(jpg|webp|png|gif|jpeg)$/)) {
                        let urlpart ='url("'+retVal.props.original+'")'
                        if(seen.indexOf(urlpart)==-1){
                            nextsrc = urlpart
                            ctxm = retVal.props.onContextMenu
                            srctype    = 'img'
                        }
                    }else if (this.settings.captureImages && retVal.props.original && retVal.props.src.match(/(\.jpg\?|\.webp\?|\.gif\?|\.jpeg\?)/)) {
                        let urlpart ='url("'+retVal.props.original+'")'
                        if(seen.indexOf(urlpart)==-1){
                            nextsrc = urlpart
                            ctxm = retVal.props.onContextMenu
                            srctype    = 'img'
                        }
                    }

                    let videoadded=false;
                    if(nextsrc != null && vid){

                        let chacheseen = this.cacheseen[this.currentChannel]
                        let chache     = this.chache[this.currentChannel]
                        if(!chache){
                            chache = []
                            this.chache[this.currentChannel] = chache

                        }

                        if(!chacheseen){
                            chacheseen = []
                            this.cacheseen[this.currentChannel] = chacheseen

                        }

                        if(chacheseen.indexOf(nextsrc)==-1){
                            chache.push({'src':nextsrc,'type':srctype, 'ctxm':ctxm, 'thumb':thumb})
                            chacheseen.push(nextsrc)
                            
                            if(this.isFullscreenMode() || this.isBGOverride(channel)){

                                console.log('nextsrc',nextsrc)
                                if(srctype=='img'){
                                    vid.style.backgroundImage = nextsrc
                                    if(!this.isFullscreenMode()){
                                        vid.style.backgroundAttachment='fixed'
                                        vid.style.backgroundSize='contain'
                                        vid.style.backgroundRepeatX='no-repeat'
                                        vid.style.backgroundRepeatY='no-repeat'
                                        vid.style.backgroundPosition='center center';

                                    }
                                    if(vid.onContextMenuprop){
                                        vid.removeEventListener("contextmenu", vid.onContextMenuprop)
                                    }
                                    vid.onContextMenuprop = ctxm
                                    vid.addEventListener("contextmenu", vid.onContextMenuprop);
                                    vid.src = '';
                                    vid.origsrc=null;
                                    videoadded = true;
                                }else{
                                    vid.src = nextsrc;
                                    vid.origsrc=nextsrc;
                                    vid.style.display=''                    

                                    vid.style.backgroundImage='';
                                    if(thumb){
                                        vid.style.backgroundImage=thumb;
                                        vid.thumb=thumb
                                    }

                                    if(vid.onContextMenuprop){
                                        vid.removeEventListener("contextmenu", vid.onContextMenuprop)
                                    }
                                    vid.onContextMenuprop = ctxm
                                    vid.addEventListener("contextmenu", vid.onContextMenuprop);
                                    videoadded=true;
                                }
                            }else{
                                this.paneindex = Math.max(this.paneindex-1,0)
                            }

                        }
                    } else {
                        this.paneindex = Math.max(this.paneindex-1,0)
                    }

                    if(videoadded){
                        this.applypauserule()
                    }
                }
                
            });


SelectedChannelStore.addChangeListener(this.channelChange);
this.promises = {state: {cancelled: false}, cancel() {this.state.cancelled = true;}};
this.patchChannelContextMenu();

document.body.addEventListener('keydown', (e) => { this.keyEvent(e) } );
}

advance(){
    const elements = document.getElementsByClassName('cfgridcell');

    let gridvaluex = document.getElementById('fspaneoptselectx').value.split(' ')[0]
    let gridvaluey = document.getElementById('fspaneoptselecty').value.split(' ')[0]

    let gx = gridvaluex*1
    let gy = gridvaluey*1

    let bigplayer = document.getElementById("fsvideowrappercontentflooderbigplayer")

    let ind = 0
    if(bigplayer.style.display == ''){

        for(let i=0;i<elements.length;i++){
            if( (elements[i].src == bigplayer.src || elements[i].origsrc == bigplayer.src) && elements[i].style.backgroundImage == bigplayer.style.backgroundImage){
                ind = i;
                break
            }
        }
        let next = elements[(ind+1)%elements.length]
        bigplayer.style.backgroundImage=next.style.backgroundImage
        if(bigplayer.onContextMenuprop){
            bigplayer.removeEventListener("contextmenu", bigplayer.onContextMenuprop)
        }
        bigplayer.onContextMenuprop = next.onContextMenuprop
        bigplayer.addEventListener("contextmenu", bigplayer.onContextMenuprop);

        if(next.origsrc != null){
            bigplayer.src=next.origsrc    
        }else{
            bigplayer.src=next.src
        }

    }
    if(ind == (elements.length-1)){
        for(let i=0;i<(gx*gy);i++){
            this.updatevideoGridOffset(1)
        }
    }
}

maxvidsChange(){


    let maxplay = document.getElementById('fspaneoptmaxVideos').value;
    if(maxplay == 'no max playing limit'){
        this.maximumplayingvideos=99999;
    }else{
        this.maximumplayingvideos = maxplay.split(' ')[0]*1
    }

    this.applypauserule()

}

advChange(){
    let advopt = document.getElementById('fspaneoptselectauto').value;
    let advctime = 0;
    if(advopt == 'auto off'){
        advctime = 0;
        if(this.autoInterval != null){
            clearInterval(this.autoInterval);
        }
    }else{
        advctime = advopt.split(' ')[0]*1000.0
        if(advctime>0){
            if(this.autoInterval != null){
                clearInterval(this.autoInterval);
            }
            this.autoInterval = setInterval(this.advance, advctime);
        }else{
            if(this.autoInterval != null){
                clearInterval(this.autoInterval);
            }
        }
    }            
}

volChange(){
    this.volume = (document.getElementById('fspaneoptselectvol').value.split(' ')[1]*1.0)/100.0
    let gridElements = document.getElementsByClassName('cfgridcell') 
    let vi = 0;
    for(vi in gridElements){
        if(gridElements[vi] && gridElements[vi].volume){
            gridElements[vi].volume = this.volume;

        }                          
    }
    let bigplayer = document.getElementById("fsvideowrappercontentflooderbigplayer")
    bigplayer.volume = this.volume;    
}


updatevideoGridOffset(e){
    if(e.preventDefault){
        e.preventDefault();    
    }
    
    const elements = document.getElementsByClassName('cfgridcell');
    
    if((e.deltaY && e.deltaY>=0) || e>0){
        this.cacheoffset =  Math.max(this.cacheoffset+1,0);
    }else{
        this.cacheoffset =  Math.max(this.cacheoffset-1,0);
    }

    console.log(this.cacheoffset)

    let chache = []

    chache = this.chache[this.currentChannel]
    
    if(!chache){
        chache = []
        this.chache[this.currentChannel] = chache
    }

    let lasti = 0
    for(let i=0;i<elements.length;i++){
        let vid = elements[i]
        lasti=i;

        if(chache[(this.cacheoffset+i)%chache.length]){
            let entry = chache[(this.cacheoffset+i)%chache.length];
            if(entry['type']=='img'){
                vid.style.backgroundImage = entry['src']
                vid.src='';
                vid.origsrc=null;
                if(vid.onContextMenuprop){
                    vid.removeEventListener("contextmenu", vid.onContextMenuprop)
                }
                vid.onContextMenuprop = entry['ctxm']
                vid.addEventListener("contextmenu", vid.onContextMenuprop);

            }else{
                vid.src = entry['src']
                vid.origsrc=entry['src']
                if(vid.onContextMenuprop){
                    vid.removeEventListener("contextmenu", vid.onContextMenuprop)
                }
                vid.onContextMenuProp = entry['ctxm']

                vid.addEventListener("contextmenu", vid.onContextMenuProp);
                if(entry['thumb'] != null){
                    vid.style.backgroundImage=entry['thumb'];
                    vid.thumb=entry['thumb'];
                }else{
                    vid.style.backgroundImage='';    
                    vid.thumb=null;
                }
                
            }
        }
    }
    this.applypauserule()


}

bigWheel(e){
    e.preventDefault();

    let gridvaluex = document.getElementById('fspaneoptselectx').value.split(' ')[0]
    let gridvaluey = document.getElementById('fspaneoptselecty').value.split(' ')[0]

    let gx = gridvaluex*1
    let gy = gridvaluey*1

    const elements = document.getElementsByClassName('cfgridcell');
    let ind = 0
    for(let i=0;i<elements.length;i++){
        if(  (elements[i].src == e.target.src || elements[i].origsrc == e.target.src)   && elements[i].style.backgroundImage == e.target.style.backgroundImage){
            ind = i;
            break
        }
    }
    if(e.deltaY && e.deltaY>=0){
        ind+=1
    }else{
        ind-=1
    }

    if(ind < 0){
        ind = elements.length-1 
    }
    let next = elements[ind%elements.length]
    let bigplayer = document.getElementById("fsvideowrappercontentflooderbigplayer")

    bigplayer.style.display=''
    bigplayer.style.backgroundImage=next.style.backgroundImage
    if(bigplayer.onContextMenuprop){
        bigplayer.removeEventListener("contextmenu", bigplayer.onContextMenuprop)
    }
    bigplayer.onContextMenuprop = next.onContextMenuprop
    bigplayer.addEventListener("contextmenu", bigplayer.onContextMenuprop);

    if(next.origsrc != null){
        bigplayer.src=next.origsrc    
    }else{
        bigplayer.src=next.src
    }
    if(ind == (elements.length-1)){
        for(let i=0;i<(gx*gy);i++){
            this.updatevideoGridOffset(1)
        }
    }

    

}

bigplayerhide(e){
    let bigplayer = document.getElementById("fsvideowrappercontentflooderbigplayer")
    bigplayer.src=''
    bigplayer.style.backgroundImage=''
    bigplayer.style.display='none'
    this.applypauserule()
}

bigplayershow(e){
    let bigplayer = document.getElementById("fsvideowrappercontentflooderbigplayer")

    bigplayer.style.display=''
    bigplayer.style.backgroundImage=e.target.style.backgroundImage
    if(bigplayer.onContextMenuprop){
        bigplayer.removeEventListener("contextmenu", bigplayer.onContextMenuprop)
    }
    bigplayer.onContextMenuprop = e.target.onContextMenuprop
    bigplayer.addEventListener("contextmenu", bigplayer.onContextMenuprop);

    if(e.target.origsrc){
        bigplayer.src=e.target.origsrc    
    }else{
        bigplayer.src=e.target.src
    }
    
    const elements = document.getElementsByClassName('cfgridcell');
    for(let i=0;i<elements.length;i++){
        elements[i].pause()
    }


}

optionChange(){
    console.log('optionChange')
    let fspane = document.getElementById('fsfullscreencontentflooder')
    let gridvaluex = document.getElementById('fspaneoptselectx').value.split(' ')[0]
    let gridvaluey = document.getElementById('fspaneoptselecty').value.split(' ')[0]

    let gx = gridvaluex*1
    let gy = gridvaluey*1

    const elements = document.getElementsByClassName('cfgridcell');
    while(elements.length > 0){
        elements[0].parentNode.removeChild(elements[0]);
    }

    let chache = []

    chache = this.chache[this.currentChannel]
    
    if(!chache){
        chache = []
        this.chache[this.currentChannel] = chache
    }

    this.cacheoffset =  Math.max(chache.length-(gx*gy),0);

    for (let i = 0; i < (gx*gy); i++) {
        let vid = document.createElement("video");
        vid.className='cfgridcell'
        vid.style.width= (100.0/gx)+'%'
        vid.style.height= (100.0/gy)+'%'
        vid.style.margin= '0px'
        vid.style.padding= '0px'
        vid.autoplay=true
        vid.loop=true

        vid.volume=this.volume
        vid.style.backgroundSize='contain'
        vid.style.backgroundRepeatX='no-repeat'
        vid.style.backgroundRepeatY='no-repeat'
        vid.style.backgroundPosition='center center';
        vid.style.opacity='1.0'
        vid.addEventListener("click", this.bigplayershow )

        vid.addEventListener("wheel", (e) => { this.debouncedupdatevideoGridOffset(e) });

        if(chache[(this.cacheoffset+i)%chache.length]){
            let entry = chache[(this.cacheoffset+i)%chache.length];
            if(entry['type']=='img'){
                vid.style.backgroundImage = entry['src']
                vid.src='';
                vid.origsrc=null;

                if(vid.onContextMenuprop){
                    vid.removeEventListener("contextmenu", vid.onContextMenuprop)
                }
                vid.onContextMenuprop = entry['ctxm']
                vid.addEventListener("contextmenu", vid.onContextMenuprop);

            }else{
                vid.src = entry['src']
                vid.origsrc=entry['src']
                if(vid.onContextMenuprop){
                    vid.removeEventListener("contextmenu", vid.onContextMenuprop)
                }
                vid.onContextMenuProp = entry['ctxm']
                vid.addEventListener("contextmenu", vid.onContextMenuProp);
                
                if(entry['thumb'] != null){
                    vid.style.backgroundImage=entry['thumb'];
                    vid.thumb=entry['thumb']
                }else{
                    vid.style.backgroundImage='';
                    vid.thumb=null;    
                }
            }
        }

        fspane.appendChild(vid)
    }
    this.applypauserule()

}


applypauserule(){

    let gridElements = document.getElementsByClassName('cfgridcell') 
    let vi = 0;
    let videoCount=0;
    for(vi in gridElements){
        if(gridElements[vi] && gridElements[vi].src && gridElements[vi].src.length && gridElements[vi].src.length > 0){
            videoCount += 1
        }                          
    }
    if(videoCount > this.maximumplayingvideos){
        let paused = []
        for(vi in gridElements){
            if(gridElements[vi] && 

                ((gridElements[vi].src && gridElements[vi].src.length && gridElements[vi].src.length > 0)
                    ||
                    ((gridElements[vi].origsrc && gridElements[vi].origsrc.length && gridElements[vi].origsrc.length > 0)))

                ){

                if(gridElements[vi].origsrc != null){
                    gridElements[vi].src = ''
                }
                paused.push(gridElements[vi]);
            }                          
        }

        for (var i = paused.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = paused[i];
            paused[i] = paused[j];
            paused[j] = temp;
        }

        for(let i=0;i< Math.min(paused.length,this.maximumplayingvideos);i++){

            if(paused[i].origsrc != null){
                paused[i].autoplay=true
                paused[i].src = paused[i].origsrc;
            }
            
        }

    }else{
        for(let i=0;i<gridElements.length;i++){
            if(gridElements[i] && gridElements[i].play){
                gridElements[i].play()
            }
        }

    }

}

keyEvent(e){
    if(e.ctrlKey && e.key=='h'){
        let bigplayer = document.getElementById("fsvideowrappercontentflooderbigplayer")
        if(bigplayer.className == ''){
            bigplayer.className = 'fullscreen-box'
            document.documentElement.requestFullscreen()
        }else if(bigplayer.className == 'fullscreen-box'){
            bigplayer.className = 'fullscreen-box zoom-in-out-box'
            document.documentElement.requestFullscreen()
        }else{
            bigplayer.className = ''
            document.exitFullscreen()
        }

    }
    if(e.ctrlKey && e.key=='j'){
        this.fullscreen = !this.fullscreen;
        let fspane = document.getElementById('fsfullscreencontentflooder')
        if(fspane){
            if(this.fullscreen){
                fspane.style.display=''
                this.optionChange()
                this.applypauserule()

            }else{
                fspane.style.display='none'
                let bigplayer = document.getElementById("fsvideowrappercontentflooderbigplayer")
                bigplayer.src=''
                bigplayer.style.backgroundImage=''
                bigplayer.style.display='none'

                const elements = document.getElementsByClassName('cfgridcell');
                for(let i=0;i<elements.length;i++){
                    elements[i].pause()
                }

            }
        }

    }    
}

onStop() {
    BdApi.saveData(this.meta.name, "floodModeOn", this.floodedChannels);
    BdApi.saveData(this.meta.name, "seen", this.seenChannels);
    BdApi.saveData(this.meta.name, "postCache", this.chache);

    this.contextMenuPatch?.();
    this.contextMenuUserPatch?.();
    SelectedChannelStore.removeChangeListener(this.channelChange);

}

isFlooding(channel) {
    return this.floodedChannels.has(channel.id);
}

isLowOpacity(channel) {
    return this.lowOpacityChannels.has(channel.id);
}

isBGOverride(channel) {
    return this.bgOverrideChannels.has(channel.id);
}


addStyle() {
    DOM.addStyle(this.meta.name, this.styleTemplate);
}

addBgOverride(channel) {
    this.bgOverrideChannels.add(channel.id);
    Dispatcher.emit("flood");
    BdApi.saveData(this.meta.name, "backgroundOverrideModeOn", this.bgOverrideChannels);
}


removeBgOverride(channel) {
    this.bgOverrideChannels.delete(channel.id);
    Dispatcher.emit("flood");
    BdApi.saveData(this.meta.name, "backgroundOverrideModeOn", this.bgOverrideChannels);
}


addFlood(channel) {
    this.floodedChannels.add(channel.id);
    Dispatcher.emit("flood");
    BdApi.saveData(this.meta.name, "floodModeOn", this.floodedChannels);
}

addLowOpacity(channel) {
    this.lowOpacityChannels.add(channel.id);
    Dispatcher.emit("flood");
    BdApi.saveData(this.meta.name, "opacityModeOn", this.lowOpacityChannels);
}


removeFlood(channel) {
    this.floodedChannels.delete(channel.id);
    Dispatcher.emit("flood");
    BdApi.saveData(this.meta.name, "floodModeOn", this.floodedChannels);
}

removeLowOpacity(channel) {
    this.lowOpacityChannels.delete(channel.id);
    Dispatcher.emit("flood");
    BdApi.saveData(this.meta.name, "opacityModeOn", this.lowOpacityChannels);
}

channelChange() {
    const channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());
    this.currentChannel = channel.id
    if (!channel?.id || this.seenChannels.has(channel.id)) return;
    this.seenChannels.add(channel.id);
    BdApi.saveData(this.meta.name, "seen", this.seenChannels);
}

patchChannelContextMenu() {
    this.contextMenuPatch = ContextMenu.patch("channel-context", (retVal, props) => {


        const newItembg = ContextMenu.buildItem({
            type: "toggle",
            label: "Override channel background",
            active: this.isBGOverride(props.channel),
            action: () => {
                if (this.isBGOverride(props.channel)) this.removeBgOverride(props.channel);
                else this.addBgOverride(props.channel);
            }
        });


        retVal.props.children.splice(1, 0, newItembg);


        const newItemopacity = ContextMenu.buildItem({
            type: "toggle",
            label: "Low Opacity Posts In Flood Mode",
            active: this.isLowOpacity(props.channel),
            action: () => {
                if (this.isLowOpacity(props.channel)) this.removeLowOpacity(props.channel);
                else this.addLowOpacity(props.channel);
            }
        });


        retVal.props.children.splice(1, 0, newItemopacity);

        const newItem = ContextMenu.buildItem({
            type: "toggle",
            label: "Enable ContentFlood Gallery",
            active: this.isFlooding(props.channel),
            action: () => {
                if (this.isFlooding(props.channel)) this.removeFlood(props.channel);
                else this.addFlood(props.channel);
            }
        });

        retVal.props.children.splice(1, 0, newItem);

    });

    this.contextMenuUserPatch = ContextMenu.patch("user-context", (retVal, props) => {


        const newItembg = ContextMenu.buildItem({
            type: "toggle",
            label: "Override channel background",
            active: this.isBGOverride(props.channel),
            action: () => {
                if (this.isBGOverride(props.channel)) this.removeBgOverride(props.channel);
                else this.addBgOverride(props.channel);
            }
        });


        retVal.props.children.splice(1, 0, newItembg);


        const newItemopacity = ContextMenu.buildItem({
            type: "toggle",
            label: "Low Opacity Posts In Flood Mode",
            active: this.isLowOpacity(props.channel),
            action: () => {
                if (this.isLowOpacity(props.channel)) this.removeLowOpacity(props.channel);
                else this.addLowOpacity(props.channel);
            }
        });


        retVal.props.children.splice(1, 0, newItemopacity);

        const newItem = ContextMenu.buildItem({
            type: "toggle",
            label: "Enable ContentFlood Gallery",
            active: this.isFlooding(props.channel),
            action: () => {
                if (this.isFlooding(props.channel)) this.removeFlood(props.channel);
                else this.addFlood(props.channel);
            }
        });

        retVal.props.children.splice(1, 0, newItem);

    });

    
}


getSettingsPanel() {
    const panel = this.buildSettingsPanel();
    return panel.getElement();
}

};
};
return plugin(Plugin, Api);
})(global.ZeresPluginLibrary.buildPlugin(config));
/*@end@*/