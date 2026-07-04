package de.cannaverein.goerlitz;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Android-Zurueck-Knopf: im WebView-Verlauf zurueckblaettern, statt die
    // App sofort zu beenden. Die geladene Seite ist eine normale Website ohne
    // Capacitor-JS, daher wird das hier nativ gesteuert. Gibt es keinen
    // Verlauf mehr (Startseite), verhaelt sich Zurueck normal (App verlassen).
    OnBackPressedCallback rueck = new OnBackPressedCallback(true) {
      @Override
      public void handleOnBackPressed() {
        WebView web = getBridge() != null ? getBridge().getWebView() : null;
        if (web != null && web.canGoBack()) {
          web.goBack();
        } else {
          // Kein Verlauf mehr: Callback abschalten und Standard greifen lassen
          // (App in den Hintergrund / verlassen).
          setEnabled(false);
          getOnBackPressedDispatcher().onBackPressed();
        }
      }
    };
    getOnBackPressedDispatcher().addCallback(this, rueck);
  }
}
