package com.risinu.thisweek;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThisWeekBlockerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
