package com.risinu.thisweek;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.AlphaAnimation;
import android.view.animation.Animation;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import java.util.Locale;

public class LockOverlayActivity extends AppCompatActivity {

    private TextView countdownView;
    private TextView reasonView;
    private TextView untilView;
    private TextView brandView;
    private Handler timerHandler;
    private Runnable timerRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                goHome();
            }
        });

        buildUi();
        refreshState();

        timerHandler = new Handler(Looper.getMainLooper());
        timerRunnable = new Runnable() {
            @Override
            public void run() {
                refreshState();
                timerHandler.postDelayed(this, 1000L);
            }
        };
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        refreshState();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshState();
        if (timerHandler != null && timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
            timerHandler.post(timerRunnable);
        }
    }

    @Override
    protected void onPause() {
        if (timerHandler != null && timerRunnable != null) {
            timerHandler.removeCallbacks(timerRunnable);
        }
        super.onPause();
    }

    private void buildUi() {
        GradientDrawable bg = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{
                        Color.parseColor("#030A22"),
                        Color.parseColor("#0B2666"),
                        Color.parseColor("#041238")
                }
        );

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackground(bg);
        int pad = dp(24);
        root.setPadding(pad, dp(48), pad, dp(40));

        brandView = new TextView(this);
        brandView.setText("THIS WEEK · FOCUS SHIELD");
        brandView.setTextColor(Color.parseColor("#7DD3FC"));
        brandView.setTextSize(12f);
        brandView.setTypeface(Typeface.DEFAULT_BOLD);
        brandView.setLetterSpacing(0.16f);
        brandView.setGravity(Gravity.CENTER);
        root.addView(brandView);

        AlphaAnimation breathe = new AlphaAnimation(0.65f, 1.0f);
        breathe.setDuration(1800);
        breathe.setRepeatMode(Animation.REVERSE);
        breathe.setRepeatCount(Animation.INFINITE);
        brandView.startAnimation(breathe);

        // Crystal Inner Hero Card
        GradientDrawable heroGlass = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.parseColor("#333B82F6"), Color.parseColor("#1A0EA5E9")}
        );
        heroGlass.setCornerRadius(dp(32));
        heroGlass.setStroke(dp(1), Color.parseColor("#66BAE6FD"));

        LinearLayout heroBox = new LinearLayout(this);
        heroBox.setOrientation(LinearLayout.VERTICAL);
        heroBox.setGravity(Gravity.CENTER);
        heroBox.setBackground(heroGlass);
        heroBox.setPadding(dp(22), dp(26), dp(22), dp(26));
        LinearLayout.LayoutParams heroLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        heroLp.topMargin = dp(18);

        TextView title = new TextView(this);
        title.setText("Phone Locked");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28f);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        heroBox.addView(title);

        countdownView = new TextView(this);
        countdownView.setText("00:00");
        countdownView.setTextColor(Color.parseColor("#6EE7B7"));
        countdownView.setTextSize(46f);
        countdownView.setTypeface(Typeface.DEFAULT_BOLD);
        countdownView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams cdLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cdLp.topMargin = dp(12);
        heroBox.addView(countdownView, cdLp);

        reasonView = new TextView(this);
        reasonView.setTextColor(Color.parseColor("#E0F2FE"));
        reasonView.setTextSize(15f);
        reasonView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams reasonLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        reasonLp.topMargin = dp(10);
        heroBox.addView(reasonView, reasonLp);

        untilView = new TextView(this);
        untilView.setTextColor(Color.parseColor("#93C5FD"));
        untilView.setTextSize(13f);
        untilView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams untilLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        untilLp.topMargin = dp(6);
        heroBox.addView(untilView, untilLp);

        root.addView(heroBox, heroLp);

        TextView allowLabel = new TextView(this);
        allowLabel.setText("ONLY THESE APPS REMAIN UNLOCKED");
        allowLabel.setTextColor(Color.parseColor("#BAE6FD"));
        allowLabel.setTextSize(11f);
        allowLabel.setLetterSpacing(0.1f);
        allowLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams alLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        alLp.topMargin = dp(28);
        alLp.bottomMargin = dp(14);
        root.addView(allowLabel, alLp);

        LinearLayout row1 = new LinearLayout(this);
        row1.setOrientation(LinearLayout.HORIZONTAL);
        row1.setGravity(Gravity.CENTER);
        row1.addView(createAppButton("Phone", v -> launchDialer()));
        row1.addView(createAppButton("Contacts", v -> launchContacts()));
        row1.addView(createAppButton("Calculator", v -> launchCalculator()));
        root.addView(row1);

        LinearLayout row2 = new LinearLayout(this);
        row2.setOrientation(LinearLayout.HORIZONTAL);
        row2.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams r2Lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        r2Lp.topMargin = dp(10);
        row2.addView(createAppButton("Settings", v -> launchSettings()));
        row2.addView(createAppButton("This Week", v -> launchThisWeek()));
        root.addView(row2, r2Lp);

        // Zero unlock or bypass button by design
        TextView strictFooter = new TextView(this);
        strictFooter.setText("Strict Focus Mode · Cannot be unlocked until session ends");
        strictFooter.setTextColor(Color.parseColor("#93C5FD"));
        strictFooter.setAlpha(0.75f);
        strictFooter.setTextSize(12f);
        strictFooter.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams sfLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        sfLp.topMargin = dp(28);
        root.addView(strictFooter, sfLp);

        setContentView(root);
    }

    private View createAppButton(String label, View.OnClickListener listener) {
        GradientDrawable pill = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.parseColor("#383B82F6"), Color.parseColor("#1E0EA5E9")}
        );
        pill.setCornerRadius(dp(26));
        pill.setStroke(dp(1), Color.parseColor("#70BAE6FD"));

        TextView btn = new TextView(this);
        btn.setText(label);
        btn.setTextColor(Color.WHITE);
        btn.setTextSize(13f);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setGravity(Gravity.CENTER);
        btn.setBackground(pill);
        btn.setPadding(dp(16), dp(12), dp(16), dp(12));
        btn.setOnClickListener(listener);

        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.leftMargin = dp(6);
        lp.rightMargin = dp(6);
        btn.setLayoutParams(lp);
        return btn;
    }

    private void refreshState() {
        SchedulePrefs.ActiveLockState state = SchedulePrefs.getActiveLockState(this);
        if (!state.active) {
            finish();
            return;
        }
        long remainingMs = Math.max(0L, state.untilMs - System.currentTimeMillis());
        long totalSec = remainingMs / 1000L;
        long h = totalSec / 3600L;
        long m = (totalSec % 3600L) / 60L;
        long s = totalSec % 60L;
        if (h > 0) {
            countdownView.setText(String.format(Locale.US, "%d:%02d:%02d", h, m, s));
        } else {
            countdownView.setText(String.format(Locale.US, "%02d:%02d", m, s));
        }
        reasonView.setText(state.reason);
        untilView.setText("Locked until " + state.untilLabel);
    }

    private void launchDialer() {
        try {
            Intent intent = new Intent(Intent.ACTION_DIAL);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    private void launchContacts() {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, ContactsContract.Contacts.CONTENT_URI);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    private void launchCalculator() {
        PackageManager pm = getPackageManager();
        String[] candidates = new String[]{
                "com.sec.android.app.popupcalculator",
                "com.samsung.android.calculator",
                "com.google.android.calculator",
                "com.android.calculator2"
        };
        for (String pkg : candidates) {
            Intent launch = pm.getLaunchIntentForPackage(pkg);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(launch);
                return;
            }
        }
        try {
            Intent fallback = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALCULATOR);
            fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(fallback);
        } catch (Exception ignored) {
        }
    }

    private void launchSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    private void launchThisWeek() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }

    private void goHome() {
        Intent home = new Intent(Intent.ACTION_MAIN);
        home.addCategory(Intent.CATEGORY_HOME);
        home.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(home);
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }
}
