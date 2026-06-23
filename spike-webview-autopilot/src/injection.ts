// The load-bearing trick of the whole product.
//
// `fillEligibilityForm` is written as a SELF-CONTAINED function (no imports, no closures)
// so the exact same code can be:
//   1) injected into the WebView via `buildInjectedJavaScript()` (runs in the page), AND
//   2) unit-tested in Node against the real page HTML via jsdom (see verify-injection.mjs).
//
// Target: https://youth.europa.eu/solidarity/register/check_en
//   #edit-address-country  -> <select>  (option value, e.g. "RO")
//   #edit-birthdate        -> <input type="date">  (value "yyyy-mm-dd")

export interface EligibilityProfile {
  /** Drupal option value, e.g. "RO". See countryOptions.ts. */
  country: string;
  /** ISO date string for <input type=date>, e.g. "2006-05-14". */
  birthdate: string;
}

export interface FillResult {
  ok: boolean;
  countrySet: boolean;
  birthdateSet: boolean;
  /** What the option actually resolved to (helps catch a bad country code). */
  countryLabel: string | null;
  errors: string[];
}

/**
 * Fills the ESC eligibility form. Pure DOM manipulation — works in a WebView or jsdom.
 * Deliberately does NOT submit: the user presses Submit themselves (trust + safety).
 */
export function fillEligibilityForm(doc: Document, profile: EligibilityProfile): FillResult {
  var errors: string[] = [];
  var countrySet = false;
  var birthdateSet = false;
  var countryLabel: string | null = null;

  // --- country dropdown ---
  var country = doc.querySelector('#edit-address-country') as HTMLSelectElement | null;
  if (!country) {
    errors.push('country select #edit-address-country not found');
  } else {
    var match = null as HTMLOptionElement | null;
    for (var i = 0; i < country.options.length; i++) {
      if (country.options[i].value === profile.country) { match = country.options[i]; break; }
    }
    if (!match) {
      errors.push('no <option> with value "' + profile.country + '" in country dropdown');
    } else {
      country.value = profile.country;
      countryLabel = match.textContent ? match.textContent.trim() : null;
      // Drupal/React-style listeners react to 'change'; dispatch it so validation clears.
      country.dispatchEvent(new Event('change', { bubbles: true }));
      countrySet = country.value === profile.country;
    }
  }

  // --- date of birth ---
  var dob = doc.querySelector('#edit-birthdate') as HTMLInputElement | null;
  if (!dob) {
    errors.push('birthdate input #edit-birthdate not found');
  } else {
    dob.value = profile.birthdate;
    dob.dispatchEvent(new Event('input', { bubbles: true }));
    dob.dispatchEvent(new Event('change', { bubbles: true }));
    birthdateSet = dob.value === profile.birthdate;
  }

  return {
    ok: countrySet && birthdateSet,
    countrySet,
    birthdateSet,
    countryLabel,
    errors,
  };
}

/**
 * Serialize `fillEligibilityForm` + the profile into a string for
 * react-native-webview's `injectedJavaScript`. The trailing `true;` is required by iOS.
 * The result is posted back to RN via window.ReactNativeWebView.postMessage so the
 * `fill_form` tool can return a real result to the Realtime model.
 */
export function buildInjectedJavaScript(profile: EligibilityProfile): string {
  return (
    '(function(){try{' +
    'var fn = ' + fillEligibilityForm.toString() + ';' +
    'var result = fn(document, ' + JSON.stringify(profile) + ');' +
    'window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:"fill_form_result",result:result}));' +
    '}catch(e){' +
    'window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:"fill_form_error",error:String(e)}));' +
    '}})(); true;'
  );
}
