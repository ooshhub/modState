/* globals state, playerIsGM, sendChat, log, on */

const modState = (() => { // eslint-disable-line

  // const state = this.state || { customCrit5e: { version: '0.2.2' } };

  const scriptName = 'modState',
    scriptVersion = '0.1.0';

  class Helpers {

    static getObjectPath(baseObject, pathString, writeMode = false,  createPath = false) {
      const parts = pathString.split(/\s*\/+\s*/g).filter(v=>v);
      let targetKey = null;
      if (writeMode) targetKey = parts.pop();
      const targetObject = (pathString) 
        ? parts.reduce((m,v) => {
          if (!m) return;
          if (!Reflect.has(m, v)) {
            if (createPath) m[v] = {};
            else return null;
          }
          return m[v];
        }, baseObject)
        : baseObject;
      return { targetObject, targetKey };
    }

    static primitives = ['string', 'number', 'boolean', 'null', 'undefined', 'bigint', 'symbol'];
    static flattenObjectPaths(rootObject, rootPath='') {
      const output = {};
      const processObject = (currentObject, currentPath) => {
        for (const key in currentObject) {
          const currentType = typeof(currentObject[key]);
          if (this.primitives.includes(currentType)) output[`${currentPath}${key}`] = currentObject[key];
          else if (typeof(currentObject[key]) === 'object') processObject(currentObject[key], `${currentPath}${key}/`);
        }
        return output;
      }
      return processObject(rootObject, rootPath);
    }

    static rxTypes = {
      booleanTrue: /^true$/i,
      booleanFalse: /^false$/i,
      integer: /^(\+|-)?[\d]+$/,
      float: /^(\+|-)?\d*.\d+$/,
      null: /^null$/i,
      undefined: /^undefined$/i
    };
    static typeCheck = (inputString) => {
      let inputType = 'string';
      for (const key in this.rxTypes) {
        if (this.rxTypes[key].test(inputString)) {
          inputType = key;
          break;
        }
      }
      return inputType;
    }

    static escapeControlCharacters(string) {
      if (typeof(string) !== 'string') return string;
      const controlCharacters = {
        '[': '&lsqb;',
        ']': '&rsqb;',
        '{': '&lcub;',
        '}': '&rcub;',
        '@': '&commat;',
        '%': '&percnt;',
        '&': '&amp;',
        '(': '&lpar;',
        ')': '&rpar;'
      }
      const rx = new RegExp(`[\\${Object.keys(controlCharacters).join('\\')}]`, 'g');
      return string.replace(rx, (m) => controlCharacters[m]);
    }

    static sysChat(msg) { sendChat(scriptName, `/w gm ${msg}`, null, { noarchive: true }); }
  }

  class ChatTable {

    static styles = {
      outer: `border: 1px solid #430000; background-color: darkred; font-size: 1.6rem; text-align: center; white-space: break-spaces; word-break: break-all;`,
      header: `	color: whitesmoke; font-size: 1.6rem; padding: 0.5rem 0; border-bottom: 1px solid white;`,
      title: ``,
      body: ``,
      table: {
        outer: `margin: auto; text-align: left; background-color: whitesmoke; color: black; width: 100%; max-width: 80rem;`,
        headerRow: `	background-color: darkred; color: white;`,
        headerCell: `	padding: 0.5rem 0;`,
        row: ``,
        cell: `padding: 0.2rem 0.4rem; min-width: 10rem; max-width: 20rem;`,
        notLastRow: `border-bottom: 1px solid darkred;`,
        notLastColumn: `border-right: 1px solid darkred;`,
      },
      button: `background: none; border: none; color: darkblue;`
    }

    static buttonTemplate = `<a href="%%command%%" style="${this.styles.button}">%%label%%</a>`;

    static make(title = 'Table', content = 'no content', columnNames = ['Key', 'Value'], columns) {
      // Convert input to Array
      content =
        Array.isArray(content) ? content
        : typeof(content) === 'object' ? Object.entries(content)
        : [ content ];
      // Count columns
      const columnCount = 
        columns ? columns
        : Array.isArray(content[0]) ? content[0].length
        : 1;
      // Fill in header
      const tableContent = [ `<tr style="${this.styles.table.headerRow}">` ];
      for (let i=0; i<columnCount; i++) {
        tableContent.push(`<th style="${this.styles.table.headerCell}${i !== columnCount-1 ? `; ${this.styles.table.notLastColumn}` : ''}">${columnNames[i] || `No title`}</th>`);
      }
      tableContent.push(`</tr>`);
      // Fill in table body
      content.forEach((row, i) => {
        const rowHtml = [ `<tr style="${this.styles.table.row}${i !== content.length-1 ? `; ${this.styles.table.notLastRow}` : ''}">` ];
        for (let i=0; i<columnCount; i++) {
          rowHtml.push(`<td style="${this.styles.table.cell}${i !== columnCount-1 ? `; ${this.styles.table.notLastColumn}` : ''}">${Helpers.escapeControlCharacters(row[i] || row) || `No content`}</td>`);
        }
        rowHtml.push(`</tr>`)
        tableContent.push(rowHtml.join(''));
      });
      const header = `
        <div style="${this.styles.header}">
          <div style="${this.styles.title}">${title}</div>
        </div>`,
        body = `
        <div style="${this.styles.body}">
          <table style="${this.styles.table.outer}">
            ${tableContent.join('')}
          </table>
        </div>`,
        footer = `<div style="${this.styles.footer}"></div>`;
      const output = `
        <div style="${this.styles.outer}" class="${scriptName}">
          ${header}
          ${body}
          ${footer}
        </div>`;
      return output.replace(/\n/g, '');
    }

    static createCommandButtons(flatObject, basePath) {
      for (const key in flatObject) {
        flatObject[key] = this.buttonTemplate
          .replace('%%command%%', `!modState --path ${basePath}/${key.replace(/^\/+/, '')} --write ?{Enter New Value}`)
          .replace('%%label%%', `${flatObject[key]}`);
      }
    }
  }

  const readState = (path) => {
    const { targetObject } = Helpers.getObjectPath(state, path);
    if (!targetObject) Helpers.sysChat(`/w gm Bad path "${path}"`);
    else {
      if (typeof(targetObject) === 'object') {
        const flattened = Helpers.flattenObjectPaths(targetObject);
        ChatTable.createCommandButtons(flattened, path);
        const chatMessage = ChatTable.make(`state/${path.replace(/^\//, '')}`, flattened);
        Helpers.sysChat(chatMessage);
      }
      else {
        const output = { [path]: targetObject };
        ChatTable.createCommandButtons(output, '');
        const chatMessage = ChatTable.make(`state/${path.replace(/^\//, '')}`, output, ['Value']);
        Helpers.sysChat(chatMessage);
      }
    }
  }

  const writeState = (path, newValue, type='auto') => {
    const { targetObject, targetKey } = Helpers.getObjectPath(state, path, true);
    if (typeof(target) === 'object') Helpers.sysChat(`Can't write to object type at path: ${path}`);
    else {
      if (type === 'auto') type = Helpers.typeCheck(newValue.trim());
      newValue =
        type === 'string' ? `${newValue}`
        : type === 'float' ? parseFloat(newValue)
        : type === 'integer' ? parseInt(newValue)
        : type === 'booleanTrue' ? true
        : type === 'booleanFalse' ? false
        : type === 'null' ? null
        : type === 'undefined' ? undefined
        : `${newValue}`;
      targetObject[targetKey] = newValue;
      const msg =  `"${newValue}" written to path: "${path}" with data type "${type}"`;
      const chatMessage = ChatTable.make(`state/${path.replace(/^\//, '')}`, [[msg]], ['Writing value to state...'], 1);
      Helpers.sysChat(chatMessage);
    }
  }

  const handleInput = (msg) => {
    if (msg.type === 'api' && /^!modstate\s/i.test(msg.content) && playerIsGM(msg.playerid)) {
      const commandParts = msg.content.trim().split(/\s*--\s*/).filter(v=>v);
      commandParts.shift();
      const commands = { path: '', write: null, type: 'auto' };
      commandParts.forEach(command => {
        if (/^path\s/i.test(command)) commands.path = command.replace(/^path\s*/i, '');
        if (/^w(rite)?\s/i.test(command)) commands.write = command.replace(/^w(rite)?\s*/i, '');
        if (/^type\s/i.test(command)) commands.type = command.replace(/^type\s*/i, '');
      });
      if (commands.path) {
        if (commands.write != null) writeState(commands.path, commands.write);
        else readState(commands.path);
      }
      else Helpers.sysChat(`Bad path or no path supplied.`);
    }
  }

  log(`${scriptName} - v${scriptVersion}`);

  on('ready', () => {
    on('chat:message', handleInput);
  });

})();

