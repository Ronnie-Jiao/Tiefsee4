import { GroupType } from "../Config";
import { Lib } from "../Lib";
import { WebAPI } from "../WebAPI";
import { MainWindow } from "./MainWindow";

const IFRAME_INIT_DATA_KEY = "tiefsee-iframe-init";

export class Iframes {

    public monacoEditor;
    public pdfTronWebviewer;
    public cherryMarkdown;
    public textView;
    public pdfview;
    public welcomeview;
    public getText;
    public setTheme;

    constructor(M: MainWindow) {

        const _monacoEditor = new MonacoEditor(M);
        const _pdfTronWebviewer = new PdfTronWebviewer(M);
        const _cherryMarkdown = new CherryMarkdown(M);
        const _textview = new Textview(M);
        const _pdfview = new Pdfview(M);
        const _welcomeview = new Welcomeview(M);

        this.monacoEditor = _monacoEditor;
        this.pdfTronWebviewer = _pdfTronWebviewer;
        this.cherryMarkdown = _cherryMarkdown;
        this.textView = _textview;
        this.pdfview = _pdfview;
        this.welcomeview = _welcomeview;
        this.getText = getText;
        this.setTheme = setTheme;

        window.addEventListener("message", async (e) => {

            // 只開放特定網域呼叫
            if (e.origin !== APIURL && e.origin !== location.origin) {
                console.error("錯誤的請求來源：" + e.origin)
                return;
            }

            // 接收到的資料
            const type = e.data.type;
            const data = e.data.data;

            if (type === "getText") {
                _text = data;
            }

            if (type === "openUrl") {
                WV_RunApp.OpenUrl(data);
            }
            if (type === "openFile") {
                const exePath = await WV_Window.GetTiefseePath();

                const path = Lib.urlToPath(data);
                const arMsg: string[] = [];

                // 如果不是絕對路徑，則從目前檔案的資料夾尋找
                if (path.startsWith("\\\\") === false && path.startsWith(":", 1) === false) { // \\Desktop-abc\AA  C:\123.jppg                   
                    const filePath = Lib.combine([M.fileLoad.getDirPath(), path]);
                    arMsg.push(filePath);
                    if (await WV_File.Exists(filePath)) {
                        WV_RunApp.ProcessStart(exePath, `"${filePath}"`, true, false);
                        return;
                    }
                }

                arMsg.push(path);
                if (await WV_File.Exists(path)) {
                    WV_RunApp.ProcessStart(exePath, `"${path}"`, true, false);
                    return;
                }

                M.msgbox.show({
                    txt: M.i18n.t("msg.notFound") + "\n" + arMsg.join("\n")
                });
            }
            if (type === "loadDropFile") {
                await M.fileLoad.loadDropFile(data);
            }
            if (type === "saveText") {
                await M.script.file.save();
            }
        });

        var _text: null | string = null;
        async function getText() {

            let groupType = M.fileShow.getGroupType()

            if (groupType === GroupType.txt) {
                _text = _textview.getText();
            } else if (groupType === GroupType.monacoEditor) {
                _monacoEditor.getText();
            } else if (groupType === GroupType.md) {
                _cherryMarkdown.getText();
            } else {
                return "";
            }

            for (let i = 0; i < 2000; i++) { // 等待套件初始化
                if (_text !== null) {
                    break;
                }
                await Lib.sleep(10);
            }
            const text = _text
            _text = null;
            return text;
        }

        function setTheme() {
            let strTheme = JSON.stringify(M.config.settings.theme);
            window.localStorage.setItem("settings.theme", strTheme);
            let groupType = M.fileShow.getGroupType()

            if (groupType === GroupType.txt) {
            }
            if (groupType === GroupType.monacoEditor) {
                _monacoEditor.setTheme();
            }
            if (groupType === GroupType.md) {
                _cherryMarkdown.setTheme();
            }
            if (groupType === GroupType.office) {
                _pdfTronWebviewer.setTheme();
            }
        }

    }
}

class PdfTronWebviewer {
    public visible;
    public loadFile;
    public loadNone;
    public setTheme;

    constructor(M: MainWindow) {

        const _domPdftronWebviewer = document.querySelector("#mView-pdftronWebviewer") as HTMLIFrameElement;

        /** PDFTronWebviewer 是否初始化完成 */
        var _isInitPdfTronWebviewer = false;

        this.visible = visible;
        this.loadFile = loadFile;
        this.loadNone = loadNone;
        this.setTheme = setTheme;

        window.addEventListener("message", (e) => {

            // 只開放特定網域呼叫
            if (e.origin !== APIURL && e.origin !== location.origin) {
                console.error("錯誤的請求來源：" + e.origin)
                return;
            }

            // 接收到的資料
            const type = e.data.type;
            const data = e.data.data;

            if (type === "PDFTronWebviewer.initFinish") {
                _isInitPdfTronWebviewer = true;
            }
        });

        /** 
         * 顯示或隱藏dom
         */
        function visible(val: boolean) {
            if (val === true) {
                _domPdftronWebviewer.style.display = "block";
            } else {
                _domPdftronWebviewer.style.display = "none";
            }
        }

        /**
         * 載入檔案
         */
        async function loadFile(path: string) {

            if (_domPdftronWebviewer.src == "") {
                window.localStorage.setItem(IFRAME_INIT_DATA_KEY, JSON.stringify(baseWindow.appInfo));
                _domPdftronWebviewer.src = `./iframe/PDFTronWebviewer.html?lang=${M.script.window.getLang()}`;
            }

            for (let i = 0; i < 2000; i++) { //等待套件初始化
                if (_isInitPdfTronWebviewer === true) {
                    break;
                }
                await Lib.sleep(10);
            }

            const json = {
                type: "loadFile",
                data: path,
            };
            _domPdftronWebviewer.contentWindow?.postMessage(json, "*");
        }

        /**
         * 清空內容
         */
        function loadNone() {
            if (_isInitPdfTronWebviewer === false) { return; }
            postMsg({
                type: "loadNone",
                data: "",
            });
        }

        /**
         * 套用主題
         */
        function setTheme() {
            postMsg({
                type: "setTheme",
                data: null,
            });
        }

        function postMsg(json: any) {
            if (_isInitPdfTronWebviewer) {
                _domPdftronWebviewer.contentWindow?.postMessage(json, "*");
            }
        }

    }
}

class MonacoEditor {

    public visible;
    public loadFile;
    public loadText;
    public loadNone;
    public setReadonly;
    public getText;
    public setTheme;

    constructor(M: MainWindow) {

        const _domMonacoEditor = document.querySelector("#mView-monacoEditor") as HTMLIFrameElement;

        /** MonacoEditor 是否初始化完成 */
        var _isInitMonacoEditor = false;

        this.visible = visible;
        this.loadFile = loadFile;
        this.loadText = loadText;
        this.loadNone = loadNone;
        this.setReadonly = setReadonly;
        this.getText = getText;
        this.setTheme = setTheme;

        window.addEventListener("message", (e) => {

            // 只開放特定網域呼叫
            if (e.origin !== APIURL && e.origin !== location.origin) {                console.error("錯誤的請求來源：" + e.origin)
                return;
            }

            // 接收到的資料
            const type = e.data.type;
            const data = e.data.data;

            if (type === "MonacoEditor.initFinish") {
                _isInitMonacoEditor = true;
            }
        });

        /** 
         * 顯示或隱藏 dom
         */
        function visible(val: boolean) {
            if (val === true) {
                _domMonacoEditor.style.display = "block";
            } else {
                _domMonacoEditor.style.display = "none";
            }
        }

        async function awaitInit() {
            if (_domMonacoEditor.src == "") {
                window.localStorage.setItem(IFRAME_INIT_DATA_KEY, JSON.stringify(baseWindow.appInfo));
                _domMonacoEditor.src = `./iframe/MonacoEditor.html?lang=${M.script.window.getLang()}`;
            }

            for (let i = 0; i < 2000; i++) { // 等待套件初始化
                if (_isInitMonacoEditor === true) {
                    break;
                }
                await Lib.sleep(10);
            }
        }

        /**
         * 載入檔案
         * @param text 
         * @param path 檔案路徑
         */
        async function loadFile(text: string, path: string) {

            await awaitInit();

            postMsg({
                type: "loadFile",
                data: {
                    text: text,
                    path: path,
                },
            });
        }

        /**
         * 載入文字
         * @param text 
         * @param fileType 檔案類型，例如 javascript / html
         */
        async function loadText(text: string, fileType: string) {
            await awaitInit();
            postMsg({
                type: "loadText",
                data: {
                    text: text,
                    fileType: fileType,
                },
            });
        }

        /**
         * 設定是否唯讀
         */
        async function setReadonly(val: boolean) {
            await awaitInit();
            postMsg({
                type: "setReadonly",
                data: {
                    val: val,
                },
            });
        }

        /**
         * 清空內容
         */
        function loadNone() {
            postMsg({
                type: "loadNone",
                data: null,
            });
        }

        /**
         * 送出 getText 的請求
         */
        function getText() {
            postMsg({
                type: "getText",
                data: null,
            });
        }

        /**
         * 套用主題
         */
        function setTheme() {
            postMsg({
                type: "setTheme",
                data: null,
            });
        }

        function postMsg(json: any) {
            if (_isInitMonacoEditor) {
                _domMonacoEditor.contentWindow?.postMessage(json, "*");
            }
        }

    }
}

class CherryMarkdown {
    public visible;
    public loadFile;
    public loadText;
    public loadNone;
    public setReadonly;
    public getText;
    public setTheme;

    constructor(M: MainWindow) {

        const _domIframe = document.querySelector("#mView-cherryMarkdown") as HTMLIFrameElement;

        /** MonacoEditor 是否初始化完成 */
        var _isInitCherryMarkdown = false;

        this.visible = visible;
        this.loadFile = loadFile;
        this.loadText = loadText;
        this.loadNone = loadNone;
        this.setReadonly = setReadonly;
        this.getText = getText;
        this.setTheme = setTheme;

        window.addEventListener("message", (e) => {

            // 只開放特定網域呼叫
            if (e.origin !== APIURL && e.origin !== location.origin) {
                console.error("錯誤的請求來源：" + e.origin)
                return;
            }

            // 接收到的資料
            const type = e.data.type;
            const data = e.data.data;

            if (type === "CherryMarkdown.initFinish") {
                _isInitCherryMarkdown = true;
            }

        });

        /** 
         * 顯示或隱藏dom
         */
        function visible(val: boolean) {
            if (val === true) {
                _domIframe.style.display = "block";
            } else {
                _domIframe.style.display = "none";
            }
        }

        async function awaitInit() {
            if (_domIframe.src == "") {
                window.localStorage.setItem(IFRAME_INIT_DATA_KEY, JSON.stringify(baseWindow.appInfo));
                _domIframe.src = `./iframe/CherryMarkdown.html?lang=${M.script.window.getLang()}&allowCors=true`;
            }

            for (let i = 0; i < 2000; i++) { // 等待套件初始化
                if (_isInitCherryMarkdown === true) {
                    break;
                }
                await Lib.sleep(10);
            }
        }

        /**
         * 載入檔案並且設定目錄
         */
        async function loadFile(text: string, dir: string) {
            await awaitInit();
            postMsg({
                type: "loadFile",
                data: {
                    text: text,
                    dir: dir,
                },
            });
        }

        /**
         * 載入文字
         */
        async function loadText(text: string) {
            await awaitInit();
            postMsg({
                type: "loadText",
                data: {
                    text: text,
                },
            });
        }

        /**
         * 設定是否唯讀
         */
        async function setReadonly(val: boolean) {
            await awaitInit();
            postMsg({
                type: "setReadonly",
                data: {
                    val: val,
                },
            });
        }

        /**
         * 清空內容
         */
        function loadNone() {
            postMsg({
                type: "loadNone",
                data: null,
            });
        }

        /**
         * 送出 getText 的請求
         */
        function getText() {
            postMsg({
                type: "getText",
                data: null,
            });
        }

        /**
         * 套用主題
         */
        function setTheme() {
            postMsg({
                type: "setTheme",
                data: null,
            });
        }

        function postMsg(json: any) {
            if (_isInitCherryMarkdown) {
                _domIframe.contentWindow?.postMessage(json, "*");
            }
        }

    }
}

class Textview {
    public visible;
    // public loadFile;
    public loadText;
    public loadNone;
    public setReadonly;
    public getText;
    // public setTheme;

    constructor(M: MainWindow) {

        const _domText = document.querySelector("#mView-text") as HTMLTextAreaElement;

        this.visible = visible;
        // this.loadFile = loadFile;
        this.loadText = loadText;
        this.loadNone = loadNone;
        this.setReadonly = setReadonly;
        this.getText = getText;
        // this.setTheme = setTheme;

        // 處理唯讀
        _domText.addEventListener("keydown", (e) => {
            if (_isReadonly === false) { return; }

            // 只允許 Ctrl+C 跟 Ctrl+A ，其餘的按鍵都攔截
            if (e.code == "KeyC" && e.ctrlKey === true) {
            } else if (e.code == "KeyA" && e.ctrlKey === true) {
            } else {
                e.preventDefault();
            }
        })

        /** 
          * 顯示或隱藏dom
          */
        function visible(val: boolean) {
            if (val === true) {
                _domText.style.display = "block";
            } else {
                _domText.style.display = "none";
            }
        }

        /**
         * 載入文字
         */
        async function loadText(text: string) {
            _domText.scrollTo(0, 0); // 捲到最上面
            _domText.value = text;
        }

        var _isReadonly = false; // 是否為唯讀
        /**
          * 設定是否唯讀
          */
        async function setReadonly(val: boolean) {
            _isReadonly = val;
            if (val) {
                _domText.setAttribute("readonly", "readonly");
            } else {
                _domText.removeAttribute("readonly");
            }
        }

        /**
         * 清空內容
         */
        function loadNone() {
            loadText("");
        }

        function getText() {
            return _domText.value;
        }

    }
}

class Pdfview {
    public visible;
    public loadFile;
    public loadIllustratorFallback;
    public loadNone;

    constructor(M: MainWindow) {
        const _domIframe = document.querySelector("#mView-pdf") as HTMLIFrameElement;

        this.visible = visible;
        this.loadFile = loadFile;
        this.loadIllustratorFallback = loadIllustratorFallback;
        this.loadNone = loadNone;

        function visible(val: boolean) {
            _domIframe.style.display = val ? "block" : "none";
        }

        function loadFile(fileInfo2: FileInfo2) {
            // A previous non-PDF AI may have supplied a srcdoc. Remove it
            // before navigating back to the normal PDF document handler.
            _domIframe.removeAttribute("srcdoc");
            _domIframe.setAttribute("src", WebAPI.getPdf(fileInfo2));
        }

        /** Display genuine bitmap fallback, or an explicit unsupported state. */
        function loadIllustratorFallback(previewPath: string | null) {
            _domIframe.removeAttribute("src");
            const zh = navigator.language.toLowerCase().startsWith("zh");
            const heading = previewPath
                ? (zh ? "Illustrator 预览图" : "Illustrator bitmap preview")
                : (zh ? "无法预览此 AI 文件" : "This AI file cannot be previewed");
            const detail = previewPath
                ? (zh ? "此文件不包含 PDF 兼容数据，目前显示的是内嵌或系统缩略图，可能低于原稿分辨率。"
                      : "This file has no PDF-compatible data. The embedded or system preview may be lower resolution than the artwork.")
                : (zh ? "文件没有 PDF 兼容数据，也未找到可用的缩略图。可在 Illustrator 中重新保存，并勾选“创建 PDF 兼容文件”。"
                      : "No PDF-compatible data or usable thumbnail was found. Re-save in Illustrator with Create PDF Compatible File enabled.");
            const escape = (value: string) => value
                .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
            const image = previewPath
                ? `<img alt="Illustrator preview" src="${escape(WebAPI.getFile(previewPath))}">`
                : `<div class="glyph" aria-hidden="true">Ai</div>`;
            _domIframe.srcdoc = `<!doctype html><html lang="${zh ? "zh" : "en"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
:root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;min-height:100%;height:100%;font:14px/1.6 "Segoe UI",sans-serif;background:#1c2229;color:#e9edf3}
.page{height:100%;min-height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:30px}
img{display:block;max-width:100%;max-height:calc(100% - 118px);min-height:0;object-fit:contain;box-shadow:0 12px 46px #0005;border-radius:5px}
.glyph{display:grid;place-items:center;width:76px;height:76px;background:#2e241f;color:#f6a85b;border:1px solid #775039;border-radius:20px;font-weight:700;font-size:32px}
h1{margin:0;font-size:16px;font-weight:600}p{margin:0;max-width:550px;text-align:center;color:#aab5c4;font-size:12px}
</style></head><body><main class="page">${image}<div><h1 style="text-align:center">${escape(heading)}</h1>
<p>${escape(detail)}</p></div></main></body></html>`;
        }

        function loadNone() {
            _domIframe.removeAttribute("srcdoc");
            _domIframe.setAttribute("src", "");
        }
    }
}

class Welcomeview {

    public visible;
    public dom;

    constructor(M: MainWindow) {

        const _domWelcomeview = document.querySelector("#mView-welcome") as HTMLDivElement;
        this.visible = visible;
        this.dom = _domWelcomeview;

        /** 
        * 顯示或隱藏dom
        */
        function visible(val: boolean) {
            if (val === true) {
                _domWelcomeview.style.display = "flex";
            } else {
                _domWelcomeview.style.display = "none";
            }
        }

    }
}
