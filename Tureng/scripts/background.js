const ext = globalThis.browser ?? globalThis.chrome;

//Create a function to open the new tab
function newTab(info) {
  const { menuItemId } = info;

  if (menuItemId === "tureng-text-search") {
    ext.tabs.create({
      url:
        "https://tureng.com/tr/turkce-ingilizce/" +
        encodeURIComponent(info.selectionText.trim()),
    });
  }
}

//Create context menu options.

ext.runtime.onInstalled.addListener(() => {
  ext.contextMenus.create({
    title: "Tureng: '%s' ",
    id: "tureng-text-search",
    contexts: ["selection"],
  });
});

//This tells the context menu what function to run when the option is selected

ext.contextMenus.onClicked.addListener(newTab);

ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "TURENG_SEARCH") {
    const url =
      "https://tureng.com/tr/turkce-ingilizce/" +
      encodeURIComponent(message.query.trim());

    fetch(url)
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        html: await response.text(),
      }))
      .catch((error) => ({
        ok: false,
        error: error.message,
      }))
      .then(sendResponse);

    return true;
  }

  if (message?.type === "TURENG_TTS") {
    const url = `https://translate.google.com/translate_tts?client=tw-ob&ie=UTF-8&q=${encodeURIComponent(
      message.text.trim()
    )}&tl=${encodeURIComponent(message.lang)}`;

    fetch(url, { credentials: "omit" })
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        buffer: response.ok
          ? Array.from(new Uint8Array(await response.arrayBuffer()))
          : null,
      }))
      .catch((error) => ({
        ok: false,
        error: error.message,
      }))
      .then(sendResponse);

    return true;
  }
});
