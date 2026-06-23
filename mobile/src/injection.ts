// WebView DOM tools for the ESC eligibility form — the client-side half of the autopilot.
//
// IMPORTANT: the injected scripts are HAND-WRITTEN LITERAL JS STRINGS, *not* derived from
// functions via Function.toString(). React Native's Hermes engine does not return real source
// from toString() (it yields `function f(){ [bytecode] }`), which would inject broken code and
// throw "ReferenceError: bytecode is not defined" in the WebView. Keep these as literals.
//
// Each script posts a result back to RN via window.ReactNativeWebView.postMessage, tagged with
// a `requestId` so the tool router can correlate the async reply.
//
// Target: https://youth.europa.eu/solidarity/register/check_en
//   #edit-address-country  -> <select>  (option value, e.g. "RO")
//   #edit-birthdate        -> <input type="date">  (value "yyyy-mm-dd")

export interface EligibilityProfile {
  country: string; // Drupal option value, e.g. "RO"
  birthdate: string; // "yyyy-mm-dd"
}

export interface FillResult {
  ok: boolean;
  countrySet: boolean;
  birthdateSet: boolean;
  countryLabel: string | null;
  errors: string[];
}

export interface ReadResult {
  url: string;
  hasCountry: boolean;
  hasBirthdate: boolean;
  currentCountry: string;
  currentBirthdate: string;
  countryOptionsSample: { value: string; label: string }[];
  countryOptionCount: number;
}

/**
 * Literal JS that fills the eligibility form. Polls for the fields (~4.5s) so it works even if
 * the page is still loading. `requestId` correlates the async postMessage reply.
 */
export function buildInjectedJavaScript(profile: EligibilityProfile, requestId = 'fill'): string {
  const P = JSON.stringify(profile);
  const RID = JSON.stringify(requestId);
  return `(function(){
  try {
    var profile = ${P};
    var attempts = 0;
    function post(t, r){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:t, requestId:${RID}, result:r})); }
    function fill(){
      var errors=[], countrySet=false, birthdateSet=false, countryLabel=null;
      var country=document.querySelector('#edit-address-country');
      if(!country){ errors.push('country select not found'); }
      else {
        var match=null;
        for(var i=0;i<country.options.length;i++){ if(country.options[i].value===profile.country){ match=country.options[i]; break; } }
        if(!match){ errors.push('no option with value '+profile.country); }
        else {
          country.value=profile.country;
          countryLabel=(match.textContent||'').trim();
          country.dispatchEvent(new Event('change',{bubbles:true}));
          countrySet=(country.value===profile.country);
        }
      }
      var dob=document.querySelector('#edit-birthdate');
      if(!dob){ errors.push('birthdate input not found'); }
      else {
        dob.value=profile.birthdate;
        dob.dispatchEvent(new Event('input',{bubbles:true}));
        dob.dispatchEvent(new Event('change',{bubbles:true}));
        birthdateSet=(dob.value===profile.birthdate);
      }
      return {ok:(countrySet&&birthdateSet), countrySet:countrySet, birthdateSet:birthdateSet, countryLabel:countryLabel, errors:errors};
    }
    function step(){
      var r=fill();
      var notReady = r.errors && r.errors.join(' ').indexOf('not found') >= 0;
      if(notReady && attempts < 15){ attempts++; setTimeout(step, 300); return; }
      post('fill_form_result', r);
    }
    step();
  } catch(e){
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'tool_error', requestId:${RID}, error:String(e)}));
  }
})(); true;`;
}

/** Literal JS that reads the form's fields + country options. */
export function buildReadPageJavaScript(requestId = 'read'): string {
  const RID = JSON.stringify(requestId);
  return `(function(){
  try {
    var country=document.querySelector('#edit-address-country');
    var dob=document.querySelector('#edit-birthdate');
    var sample=[], count=0;
    if(country){
      count=country.options.length;
      for(var i=0;i<country.options.length && sample.length<40;i++){
        var o=country.options[i];
        if(o.value) sample.push({value:o.value, label:(o.textContent||'').trim()});
      }
    }
    var r={
      url: document.location ? document.location.href : '',
      hasCountry: !!country,
      hasBirthdate: !!dob,
      currentCountry: country ? country.value : '',
      currentBirthdate: dob ? dob.value : '',
      countryOptionsSample: sample,
      countryOptionCount: count
    };
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'read_page_result', requestId:${RID}, result:r}));
  } catch(e){
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify({type:'tool_error', requestId:${RID}, error:String(e)}));
  }
})(); true;`;
}
