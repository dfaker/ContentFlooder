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
            this.cache = []
            this.cacheseen = []
            this.paneindex = 0;
            this.volume=0;
            this.fullscreen = false;            
            this.styleTemplate = ".opacityElemFlood{opacity:0.2;} .opacityElemFlood:hover{opacity:1.0;}";
            this.channelChange = this.channelChange.bind(this);
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
            this.seenChannels = new Set(BdApi.loadData(this.meta.name, "seen") ?? []);

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

                let fspaneoptx = document.createElement("select");
                fspaneoptx.id='fspaneoptselectx'
                fspaneoptx.style.position='fixed'
                fspaneoptx.style.top='20px'
                fspaneoptx.style.left='0px'
                fspaneoptx.style.zIndex='999'
                fspaneoptx.onchange= (e) => { this.optionChange() }
                fspane.appendChild(fspaneoptx)

                let fspaneopty = document.createElement("select");
                fspaneopty.id='fspaneoptselecty'
                fspaneopty.style.position='fixed'
                fspaneopty.style.top='20px'
                fspaneopty.style.left='40px'
                fspaneopty.style.zIndex='999'
                fspaneopty.onchange= (e) => { this.optionChange() }
                fspane.appendChild(fspaneopty)


                let fspaneoptvol = document.createElement("select");
                fspaneoptvol.id='fspaneoptselectvol'
                fspaneoptvol.style.position='fixed'
                fspaneoptvol.style.top='20px'
                fspaneoptvol.style.left='80px'
                fspaneoptvol.style.zIndex='999'
                fspaneoptvol.onchange= (e) => { this.volChange() }
                fspane.appendChild(fspaneoptvol)

                for(let d=0;d<=100;d+=5){

                    let opt1 = document.createElement("option");
                    opt1.text= 'vol '+d+''
                    opt1.value= 'vol '+d+''
                    fspaneoptvol.appendChild(opt1)    

                }

                for(let d=1;d<20;d++){

                    let opt1 = document.createElement("option");
                    opt1.text= d+''
                    opt1.value= d+''
                    fspaneoptx.appendChild(opt1)                          

                    let opt2 = document.createElement("option");
                    opt2.text= d+''
                    opt2.value= d+''
                    fspaneopty.appendChild(opt2)   
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

                //console.log('retVal original',retVal.props)
                
                console.log(this.isFullscreenMode())

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


                    if (retVal.props.src && retVal.props.src.match(/(\.webm\?|\.mov\?|\.mp4\?)/)) {
                        let parts = retVal.props.src.split('?')
                        if(seen.indexOf(parts[0])==-1){
                            nextsrc = parts[0]
                            srctype    = 'video'
                        }
                    }else if (retVal.props.src && retVal.props.src.match(/(webm|mov|mp4)$/)) {
                        if(seen.indexOf(retVal.props.src)==-1){
                            nextsrc = retVal.props.src
                            srctype    = 'video'
                        }                
                    }else if (retVal.props.original && retVal.props.original.match(/(webm|mov|mp4)$/)) {
                        if(seen.indexOf(retVal.props.original)==-1){
                            nextsrc = retVal.props.original
                            srctype    = 'video'
                        }
                    }else if (retVal.props.original && retVal.props.original.match(/(jpg|webp|png|gif|jpeg)$/)) {
                        let urlpart ='url("'+retVal.props.original+'")'
                        if(seen.indexOf(urlpart)==-1){
                            nextsrc = urlpart
                            srctype    = 'img'
                        }
                    }

                    console.log(nextsrc,this.paneindex%gridElements.length)
                    if(nextsrc != null && vid){
                        if(this.cacheseen.indexOf(nextsrc)==-1){
                            this.cache.push({'src':nextsrc,'type':srctype})
                            this.cacheseen.push(nextsrc)
                        }                       

                        if(srctype=='img'){
                            vid.style.backgroundImage = nextsrc
                            if(!this.isFullscreenMode()){
                                vid.style.backgroundAttachment='fixed'
                                vid.style.backgroundSize='contain'
                                vid.style.backgroundRepeatX='no-repeat'
                                vid.style.backgroundRepeatY='no-repeat'
                                vid.style.backgroundPosition='center center';
                                
                            }
                            vid.src = '';
                        }else{
                            vid.src = nextsrc;
                            vid.style.display=''                    
                            vid.style.backgroundImage='';
                        }
                    }else{
                        this.paneindex = Math.max(this.paneindex-1,0)
                    }
                }
                
            });

            this.promises = {state: {cancelled: false}, cancel() {this.state.cancelled = true;}};
            this.patchChannelContextMenu();
            
            document.body.addEventListener('keydown', (e) => { this.keyEvent(e) } );
        }
        
        volChange(){
            this.volume = (document.getElementById('fspaneoptselectvol').value.split(' ')[1]*1.0)/100.0
            console.log(this.volume);
            let gridElements = document.getElementsByClassName('cfgridcell') 
            let vi = 0;
            for(vi in gridElements){
                if(gridElements[vi] && gridElements[vi].volume){
                    gridElements[vi].volume = this.volume;

                }                          
            }
        }

        optionChange(){
            let fspane = document.getElementById('fsfullscreencontentflooder')
            let gridvaluex = document.getElementById('fspaneoptselectx').value
            let gridvaluey = document.getElementById('fspaneoptselecty').value
            
            let gx = gridvaluex*1
            let gy = gridvaluey*1
            console.log(gx,gy)

            const elements = document.getElementsByClassName('cfgridcell');
            while(elements.length > 0){
                elements[0].parentNode.removeChild(elements[0]);
            }

            let cacheoffset = Math.floor(Math.random() * this.cache.length);

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


                if(this.cache[(cacheoffset+i)%this.cache.length]){
                    let entry = this.cache[(cacheoffset+i)%this.cache.length];
                    if(entry['type']=='img'){
                        vid.style.backgroundImage = entry['src']
                        vid.src='';
                    }else{
                        vid.src = entry['src']
                        vid.style.backgroundImage='';
                    }
                }

                fspane.appendChild(vid)
            }

        }

        keyEvent(e){
            if(e.ctrlKey && e.key=='j'){
                console.log('this.fullscreen',this.fullscreen)
                this.fullscreen = !this.fullscreen;
                console.log('this.fullscreen',e,this.fullscreen)
                let fspane = document.getElementById('fsfullscreencontentflooder')
                if(fspane){
                    if(this.fullscreen){
                        fspane.style.display=''
                    }else{
                        fspane.style.display='none'
                    }
                }

            }    
        }

        onStop() {
            BdApi.saveData(this.meta.name, "floodModeOn", this.floodedChannels);
            BdApi.saveData(this.meta.name, "seen", this.seenChannels);
            this.contextMenuPatch?.();
            SelectedChannelStore.removeChangeListener(this.channelChange);

        }

        isFlooding(channel) {
            return this.floodedChannels.has(channel.id);
        }

        isLowOpacity(channel) {
            return this.lowOpacityChannels.has(channel.id);
        }
        

        addStyle() {
            DOM.addStyle(this.meta.name, this.styleTemplate);
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
            if (!channel?.id || this.seenChannels.has(channel.id)) return;
            this.seenChannels.add(channel.id);
            BdApi.saveData(this.meta.name, "seen", this.seenChannels);
        }

        patchChannelContextMenu() {
            this.contextMenuPatch = ContextMenu.patch("channel-context", (retVal, props) => {



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
                    label: "Content Flood Mode",
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