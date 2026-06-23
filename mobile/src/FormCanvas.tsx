// Native form "browser": a real WebView the autopilot scripts via injectJavaScript. Injected
// scripts postMessage their results back, correlated by requestId. Extracted from App so the web
// build can swap in FormCanvas.web.tsx (a browser can't script a cross-origin gov form).

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export interface FormCanvasHandle {
  /** Inject JS into the live form and resolve with the postMessage reply matching requestId. */
  injectAndWait: (js: string, requestId: string) => Promise<any>;
}

interface Props {
  formUrl: string;
}

export default forwardRef<FormCanvasHandle, Props>(function FormCanvas({ formUrl }, ref) {
  const webRef = useRef<WebView>(null);
  // Pending injections, keyed by requestId, resolved by onMessage.
  const pendingRef = useRef<Map<string, (msg: any) => void>>(new Map());

  useImperativeHandle(
    ref,
    () => ({
      injectAndWait: (js: string, requestId: string) =>
        new Promise((resolve) => {
          const timer = setTimeout(() => {
            pendingRef.current.delete(requestId);
            resolve({ result: { ok: false, errors: ['webview timeout'] } });
          }, 8000);
          pendingRef.current.set(requestId, (msg) => {
            clearTimeout(timer);
            resolve(msg);
          });
          webRef.current?.injectJavaScript(js);
        }),
    }),
    []
  );

  function onMessage(e: WebViewMessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.requestId && pendingRef.current.has(msg.requestId)) {
      pendingRef.current.get(msg.requestId)!(msg);
      pendingRef.current.delete(msg.requestId);
    }
  }

  return (
    <WebView
      ref={webRef}
      source={{ uri: formUrl }}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
      style={{ flex: 1, backgroundColor: '#fff' }}
    />
  );
});
