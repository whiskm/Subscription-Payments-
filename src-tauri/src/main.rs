// Hide the console window that Windows would otherwise open next to the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    subscription_payments_lib::run()
}
