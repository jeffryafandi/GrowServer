import { defineEventHandler, readRawBody, setResponseHeader } from "h3";
import logger from "@growserver/logger";

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en" style="background-color: rgba(0,0,0,0.0); width:100%; height: 100%;">

<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Growtopia Player Support</title>
  <link rel="icon" type="image/png"
    href="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/images/growtopia.ico"
    sizes="16x16" />
  <link rel="shortcut icon"
    href="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/images/growtopia.ico"
    type="image/x-icon">
  <link rel="icon"
    href="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/images/growtopia.ico"
    type="image/x-icon">
  <link media="all" rel="stylesheet"
    href="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/css/faq-main.css">
  <link media="all" rel="stylesheet"
    href="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/css/shop-custom.css">
  <link media="all" rel="stylesheet"
    href="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/css/ingame-custom.css">
  <style>
    .modal-backdrop {
      background-color: rgba(0, 0, 0, 0.1) !important;
    }

    .modal-backdrop+div {
      overflow: auto;
    }

    .modal-body,
    .content {
      padding: 0;
    }
  </style>
</head>

<body style="background-color: rgba(0,0,0,0.0);">
  <button type="button" class="btn btn-primary hidden" data-toggle="modal" id="modalButton" data-target="#modalShow"
    data-backdrop="static" data-keyboard="false"></button>
  <div class="content">
    <section class="common-box ">
      <div class="container">
        <div class="row">
          <div class="col-md-12 col-sm-12">
            <div class="row">
              <div class="modal fade product-list-popup" id="modalShow" tabindex="-1" role="dialog" aria-hidden="false">
                <div class="modal-dialog modal-dialog-centered" role="document">
                  <div class="modal-content">
                    <div class="modal-body">
                      <div class="content">
                        <section class="common-box ">
                          <div class="container">
                            <div class="section-title center-align">
                              <h2>Log in with your Grow ID</h2>
                            </div>
                            <div class="row div-content-center">
                              <div class="col-md-12 col-sm-12">
                                <form method="POST" id="loginForm" action="/player/growid/login/validate"
                                  accept-charset="UTF-8" class="" role="form" autocomplete="off">
                                  <input name="_token" type="hidden" value="__ENCODED_DATA__">
                                  <div class="form-group">
                                    <input id="login-name" class="form-control grow-text" required="required"
                                      placeholder="Your Growtopia Name *" name="growId" value="" type="text"
                                      pattern="[A-Za-z0-9]+" title="Only letters and numbers are allowed">
                                  </div>
                                  <div class="form-group">
                                    <input id="password" class="form-control grow-text" required="required"
                                      placeholder="Your Growtopia Password *" name="password" type="password" value=""
                                      pattern="[A-Za-z0-9@._!\\-]+"
                                      title="Only letters, numbers, and @ . _ ! - are allowed">
                                  </div>
                                  <div class="form-group text-center forgot-password">
                                    <a href="https://www.growtopiagame.com/account" target="_blank">Forgot Password</a>
                                    <br>
                                    <a href="#" id="toggleRegister" style="margin-top: 5px; display: inline-block;">Register Account</a>
                                  </div>
                                  <div class="form-group text-center">
                                    <input class="btn btn-lg btn-primary grow-button" type="submit" value="Log in">
                                  </div>
                                </form>
                                <form method="POST" id="registerForm" action="/player/growid/login/validate" accept-charset="UTF-8" class="hidden" role="form" autocomplete="off">
                                  <input name="_token" type="hidden" value="__ENCODED_DATA__">
                                  <input name="reg" type="hidden" value="1">
                                  <div class="form-group">
                                    <input id="register-name" class="form-control grow-text" required="required"
                                      placeholder="Your Growtopia Name *" name="growId" value="" type="text"
                                      pattern="[A-Za-z0-9]+" title="Only letters and numbers are allowed">
                                  </div>
                                  <div class="form-group">
                                    <input id="register-email" class="form-control grow-text" required="required"
                                      placeholder="Your Email *" name="email" value="" type="email">
                                  </div>
                                  <div class="form-group">
                                    <input id="register-password" class="form-control grow-text" required="required"
                                      placeholder="Your Growtopia Password *" name="password" type="password" value=""
                                      pattern="[A-Za-z0-9@._!\\-]+"
                                      title="Only letters, numbers, and @ . _ ! - are allowed">
                                  </div>
                                  <div class="form-group">
                                    <input id="register-confirm-password" class="form-control grow-text" required="required"
                                      placeholder="Confirm Password *" name="password_confirmation" type="password" value=""
                                      pattern="[A-Za-z0-9@._!\\-]+"
                                      title="Only letters, numbers, and @ . _ ! - are allowed">
                                  </div>
                                  <div class="form-group text-center">
                                    <a href="#" id="toggleLogin" style="margin-bottom: 10px; display: inline-block;">Back to Login</a>
                                  </div>
                                  <div class="form-group text-center">
                                    <input class="btn btn-lg btn-primary grow-button" type="submit" value="Register">
                                  </div>
                                </form>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>
                      <style>
                        .hidden {
                          display: none !important;
                        }
                      </style>
                      <script>
                        document.addEventListener('DOMContentLoaded', function () {
                          var loginForm = document.getElementById('loginForm');
                          var registerForm = document.getElementById('registerForm');
                          var toggleRegister = document.getElementById('toggleRegister');
                          var toggleLogin = document.getElementById('toggleLogin');
                          var sectionTitle = document.querySelector('.section-title h2');

                          toggleRegister.addEventListener('click', function (e) {
                            e.preventDefault();
                            loginForm.classList.add('hidden');
                            registerForm.classList.remove('hidden');
                            sectionTitle.textContent = 'Register your Grow ID';
                          });

                          toggleLogin.addEventListener('click', function (e) {
                            e.preventDefault();
                            registerForm.classList.add('hidden');
                            loginForm.classList.remove('hidden');
                            sectionTitle.textContent = 'Log in with your Grow ID';
                          });

                          var loginSubmitButton = loginForm.querySelector('input[type="submit"]');
                          var loginNameInput = document.getElementById('login-name');
                          var passwordInput = document.getElementById('password');

                          loginNameInput.addEventListener('input', function () {
                            this.value = this.value.replace(/[^A-Za-z0-9]/g, '');
                          });

                          passwordInput.addEventListener('input', function () {
                            this.value = this.value.replace(/[^A-Za-z0-9@._!\\-]/g, '');
                          });

                          loginForm.addEventListener('submit', function (e) {
                            if (loginSubmitButton.disabled) {
                              e.preventDefault();
                              return false;
                            }
                            loginSubmitButton.disabled = true;
                            loginSubmitButton.value = 'Logging in...';
                          });

                          var registerSubmitButton = registerForm.querySelector('input[type="submit"]');
                          var registerNameInput = document.getElementById('register-name');
                          var registerPasswordInput = document.getElementById('register-password');
                          var registerConfirmPasswordInput = document.getElementById('register-confirm-password');

                          registerNameInput.addEventListener('input', function () {
                            this.value = this.value.replace(/[^A-Za-z0-9]/g, '');
                          });

                          registerPasswordInput.addEventListener('input', function () {
                            this.value = this.value.replace(/[^A-Za-z0-9@._!\\-]/g, '');
                          });

                          registerConfirmPasswordInput.addEventListener('input', function () {
                            this.value = this.value.replace(/[^A-Za-z0-9@._!\\-]/g, '');
                          });

                          registerForm.addEventListener('submit', function (e) {
                            if (registerSubmitButton.disabled) {
                              e.preventDefault();
                              return false;
                            }

                            if (registerPasswordInput.value !== registerConfirmPasswordInput.value) {
                              e.preventDefault();
                              alert('Passwords do not match!');
                              return false;
                            }

                            registerSubmitButton.disabled = true;
                            registerSubmitButton.value = 'Registering...';
                          });
                        });
                      </script>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</body>
<script
  src="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/js/jquery-3.7.1.min.js"></script>
<script
  src="https://s3.eu-west-1.amazonaws.com/cdn.growtopiagame.com/website/resources/assets/js/bootstrap3.min.js"></script>
<script>
  var clicked = false;
  $("a").click(function () { if (clicked === false) { clicked = true; return true; } $(this).attr("onclick", "return false;"); });
  $('document').ready(function () {
    document.onkeydown = function(e) {
      if (e.key == 123 || e.key == 'F12') { e.preventDefault(); }
      if (e.ctrlKey && e.shiftKey && (e.key == 'I' || e.key == 'C' || e.key == 'J')) { e.preventDefault(); }
      if (e.ctrlKey && (e.key == 'I' || e.key == 'U')) { e.preventDefault(); }
    };
    $('#modalButton').trigger('click');
    $('.close').on('click', function () {
      window.location = "https://login.growtopiagame.com/player/validate/close"
    });

    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        for (var i = 0; i < mutation.addedNodes.length; i++) {
          if (mutation.addedNodes[i].tagName == 'DIV') {
            var thediv = mutation.addedNodes[i];
            var sw = window.screen.width;
            if (sw < 667) {
              $(thediv).css({
                'transform': 'scale(0.75)',
                'transform-origin': '0 0',
                '-webkit-transform': 'scale(0.75)',
                '-webkit-transform-origin': '0 0',
                'overflow': 'auto'
              });
            }
          }
        }
      });
    });
    observer.observe(document.body, { attributes: false, childList: true, characterData: false });
  });
</script>

</html>`;

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event, "utf-8");

  // Parse pipe-separated client data from Growtopia client
  const params: Record<string, string> = {};
  if (body) {
    const lines = body.split("\n");
    for (const line of lines) {
      const parts = line.split("|");
      if (parts.length >= 2) {
        params[parts[0].trim()] = parts.slice(1).join("|").trim();
      }
    }
  }

  logger.info(
    `[LOGIN] Dashboard request from: ${params.tankIDName || "guest"} | protocol: ${params.protocol || "?"} | game_version: ${params.game_version || "?"}`
  );

  // Encode client data as base64 for the hidden _token field
  const encodedData = Buffer.from(JSON.stringify(params)).toString("base64");

  // Return inline HTML with embedded data (GT client WebView expects this)
  setResponseHeader(event, "Content-Type", "text/html");
  return DASHBOARD_HTML.replace(/__ENCODED_DATA__/g, encodedData);
});
