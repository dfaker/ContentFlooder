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

            this.channelChange = this.channelChange.bind(this);
        }

        onStart() {
            /** @type {Set<string>} */
            this.blurredChannels = new Set(BdApi.loadData(this.meta.name, "floodModeOn") ?? []);

            /** @type {Set<string>} */
            this.seenChannels = new Set(BdApi.loadData(this.meta.name, "seen") ?? []);

            Patcher.after(this.meta.name, InlineMediaWrapper.prototype, "render", (thisObject, _, retVal) => {
                const channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());
                if (!this.isFlooding(channel)) return;

                console.log('retVal',retVal.props.original)

                if (retVal.props.original && retVal.props.original.match(/(jpg|png|gif)$/)) {

                    let divs = document.getElementsByTagName('ol');
                    let wrapper = null;
                    let di = 0;
                    for(di in divs){
                        if(divs[di].className && divs[di].className.indexOf('scrollerInner') > -1){
                            wrapper = divs[di];
                            break
                        }
                    }
                    wrapper.style.backgroundImage='url("'+retVal.props.original+'")'
                    wrapper.style.backgroundAttachment='fixed'
                    wrapper.style.backgroundSize='contain'
                    
                    wrapper.style.backgroundPosition='center top';
                }


            });


            this.promises = {state: {cancelled: false}, cancel() {this.state.cancelled = true;}};
            this.patchChannelContextMenu();
        }
        
        onStop() {
            BdApi.saveData(this.meta.name, "floodModeOn", this.blurredChannels);
            BdApi.saveData(this.meta.name, "seen", this.seenChannels);
            this.contextMenuPatch?.();
            SelectedChannelStore.removeChangeListener(this.channelChange);
        }

        isFlooding(channel) {
            return this.blurredChannels.has(channel.id);
        }

        addFlood(channel) {
            this.blurredChannels.add(channel.id);
            Dispatcher.emit("flood");
            BdApi.saveData(this.meta.name, "floodModeOn", this.blurredChannels);
        }

        removeFlood(channel) {
            this.blurredChannels.delete(channel.id);
            Dispatcher.emit("flood");
            BdApi.saveData(this.meta.name, "floodModeOn", this.blurredChannels);
        }

        channelChange() {
            const channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());
            if (!channel?.id || this.seenChannels.has(channel.id)) return;

            this.seenChannels.add(channel.id);
            BdApi.saveData(this.meta.name, "seen", this.seenChannels);
            if (this.settings.blurNSFW && channel.nsfw) this.addFlood(channel);
        }

        patchChannelContextMenu() {
            this.contextMenuPatch = ContextMenu.patch("channel-context", (retVal, props) => {
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