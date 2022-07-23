import {AbstractPageManager} from "./abstractPageManager";
import {RequestLimiter} from "../RequestLimiter";

export class EtherscanPageManager extends AbstractPageManager {
    async init() {
        this.check()
        addEventListener('load', () => this.check())
        addEventListener('focus', () => this.check())
        addEventListener('popstate', () => this.check())
        addEventListener('click', () => setTimeout(() => this.check(), 250))
        setInterval(() => this.check(), 2000);

        // default
        this.document.addEventListener('input', e => this.inputChanged(e, e.target))
        this.document.addEventListener('change', e => this.inputChanged(e, e.target))
        this.document.addEventListener('paste', e => this.inputChanged(e, e.target))
        this.document.addEventListener('focus', e => this.inputChanged(e, e.target))
    }


    findPlacesForReverseResolve() {
        let ret = super.findPlacesForReverseResolve();
        const selector='#mainaddress, .hash-tag, #contractCopy, #addressCopy, a[href^="/address/"]';
        for (const element of this.document.querySelectorAll(selector)) {
            if (element.classList.contains('idrissReverseResolved')) continue;
            if(element.querySelector(selector)) continue;//has another element inside
            let address = element.textContent;
            if (/^0x[0-9a-fA-F]{40}$/.test(address)) {
                ret.push({address, callback:x => this.defaultReverseResolve(x, element)})
            }
        }
        return ret;
    }

    badWords = ["login", "signup", "email", "mail", "phone", "signin"];

    constructor(document) {
        super();
        this.lastEvent = null;
        this.document = document;
    }


    async inputChanged(e, input) {
        if (!await this.isEnabled()) return;
        if (this.lastEvent?.value == input.value) return;
        if (!this.allowedFiled(input)) return;
        const regxE = /^[^@]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const regxP = /^[+\s\(\)-]*([\s\(\)-]*\d){6,}[\s\(\)-]*/;
        const regxT = /^@[^\s]+/;
        if (!regxP.test(input.value) && !regxE.test(input.value) && !regxT.test(input.value)) return;
        this.lastPopup?.remove();
        this.lastEvent = {event: e, date: new Date(), input: input, value: input.value}
        setTimeout(() => this.checkInputChanged(), 500)
    }

    allowedFiled(input) {
        if (this.badWords.some(w => this.document.location.toString().toLowerCase().includes(w))) return false;
        return !this.getDisallowedNode(input)
    }

    getDisallowedNode(input) {
        if (input.type === 'password') return input;
        let node = input;
        while (node) {
            if (this.hasBadWord(node)) return node;
            node = node.parentNode;
        }
        return null;
    }

    hasBadWord(node) {
        if (node?.attributes) {
            for (const attribute of Array.from(node.attributes)) {
                if (this.badWords.some(w => attribute.name.toLowerCase().includes(w) || attribute.value.toLowerCase().includes(w))) return true;
            }
        }
        return false;
    }

    async checkInputChanged() {
        if (new Date() - this.lastEvent?.date >= 500 && this.lastEvent?.input.value == this.lastEvent?.value && this.lastEvent?.value.length >= 3) {
            let event = this.lastEvent;
            let data = await this.apiCall(this.lastEvent?.value);
            if (data && event == this.lastEvent) {
                this.showPopup(this.lastEvent.input, this.lastEvent.value, data.result||{});
            }
        }else{
            this.lastPopup?.remove();
        }
    }


    showPopup(input, key, elements) {
        this.lastPopup?.remove();
        let div = this.document.createElement('div');
        this.lastPopup = div;
        this.generatePopupContent(div, key, elements, (value) => {
            navigator.clipboard.writeText(value)
            input.value = value;
            input.focus();
            input.dispatchEvent(new Event('input'));
            let lastPopup = this.lastPopup;
            setTimeout(() => lastPopup?.remove(), 100);
            let entries = Object.entries(input);
            for (const [key, value] of entries) {
                if (key.startsWith('__reactEventHandlers$')) {//for react
                    input[key].onChange({target: input});
                }
            }
        })
        let blurHandler = () => {
            setTimeout(() => div.remove(), 500);
            input.removeEventListener('blur', blurHandler)
        }
        input.addEventListener('blur', blurHandler)
        this.document.body.append(div);
        let rect = input.getBoundingClientRect()
        div.style.position = 'absolute';
        div.style.left = rect.left + 'px';
        div.style.top = rect.top + rect.height + 'px';
        div.style.width = rect.width + 'px';
        div.style.minWidth = '400px';
        div.style.zindex = 1000000;

    }

}