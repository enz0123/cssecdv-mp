$(document).ready(function(){

    $("#forgot-password").click(() => {
        let logUsername = $('#log-username').val()

        if(logUsername.length < 1){
            alert('Please input a username to continue.');
            return;
        }

        if(logUsername.length > 20){
            alert('Username must be less than 20 characters before continuing.');
            return;
        }

        window.location.href = '/forgot-password?username=' + encodeURIComponent(logUsername);
    });

    // Check login status on load
    $.get(
        'loggedInStatus',
        function(data, status){
            if(status === 'success'){
                $("#login").hide();

                if(data.isAuthenticated){
                    $(".nav-logged-out").hide();
                    $(".nav-logged-in").show();

                    $("#username-display").text(data.username);
                    $("#profile-link").attr('href', 'profile/' + data.username);
                    $('#profile-link img').attr('src', data.picture);

                    showLogInView();
                    $("#login").hide();
                    updateDropdownText(data.username); // changes the dropdown

                    // Show admin dashboard links only for Admin role
                    if (data.role === 'Admin') {
                        $("#admin-dashboard-dropdown").show();
                    } else {
                        $("#admin-dashboard-dropdown").hide();
                    }

                    if(typeof checkUser === 'function'){
                        checkUser();
                    } else {
                        console.log('Not view profile page');
                    }
                }
                else{
                    $(".nav-logged-in").hide();
                    $(".nav-logged-out").show();
                    $("#logout-button").hide();

                    $("#admin-dashboard-dropdown").hide();

                    if(typeof checkUser === 'function'){
                        checkUser();
                    } else {
                        console.log('Not view profile page');
                    }
                }
            }
        }
    );

    // Logout (server-side)
    $("#logout-button").click(function(){
        $.post(
            'logout',
            {},
            function(data, status){
                if(status === 'success') {
                    $(".nav-logged-in").hide();
                    $("#logout-button").hide();
                    // admin links will be hidden on reload by loggedInStatus
                    window.location.href="/";
                }
                else{
                    alert('Error logging out.');
                }
            }
        );
    });

    // Account creation form submission
    $("#create-account-form").submit(function(event) {
        event.preventDefault();
        
        if (!checkCreateAccountForm()) {
            return;
        }

        var iconPath = $('input[name="avatar"]:checked')
            .closest('.select-avatar')
            .find('img.avatar')
            .attr('src');

        const formData = {
            username: $("#create-account-form input[name='username']").val(),
            password: $("#create-account-form input[name='password']").val(),
            picture: iconPath,
            bio: $("#create-account-form textarea[name='description']").val(),
            securityQn1: $("#securityQuestion1").val(),
            securityQn2: $("#securityQuestion2").val(),
            securityAnswer1: $("#security-answer-1").val(),
            securityAnswer2: $("#security-answer-2").val()
        };

        $("#create-account").hide();

        $.post('/create-account', formData)
            .done(function(response) {
                alert(response.message);
            })
            .fail(function(xhr, status, error) {
                console.error('Error creating account:', error);
                alert(xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Error creating account.');
            });
    });

    // Login form submission
    $('#login-form').submit(function(event) {
        event.preventDefault();

        if (!checkLoginForm()) {
            return;
        }

        const username = $("#login-form input[name='username']").val();
        const password = $("#login-form input[name='password']").val();
        const rememberMe = $("#login-form input[type='checkbox']").prop('checked');

        $("#login").hide();

        $.post('/login', { username, password, rememberMe })
            .done(function(response) {
                console.log(response.message);

                $("#username-display").text(username);
                $("#profile-link").attr('href', 'profile/' + username);
                $('#profile-link img').attr('src', response.picture);

                showLogInView();
                $("#login").hide();
                updateDropdownText(username);

                alert("Welcome to The Condo Bro, " + username + " " + response.message);

                window.location.href="/";
            })
            .fail(function(xhr, status, error) {
                console.error('Login failed:', error);
                alert(xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Login failed.');
            });
    });

    $("#create-account").hide();

    // Dropdown magic
    $(".icon").hover(function(){
        $(this).toggleClass("highlighted");
    });

    $(".icon").hover(function(){
        $(".nav-dropdown").toggle($(this).hasClass("highlighted"));
    });

    $("#show-login").click(function(){
        $("#login").slideDown();
        $(".nav-dropdown").hide();
    });

    $("#close").click(function(){
        $("#login").hide();
    });
    
    $("#close-create").click(function(){
        $("#create-account").hide();
    });

    $("#show-create-account").click(function(){
        $("#create-account").show();
    });

    // Login button click event
    $("#login-button").click(function(){
        if ($(this).text() === "View Profile") {
            window.location.href = "/profile/" + $("#username-display").text();
        } else {
            $("#login").slideDown();
            $(".nav-dropdown").hide();
        }
    });

    // Signup button click event
    $("#signup-button").click(function(){
        if ($(this).text() === "Edit Profile") {
            window.location.href = "/edit-profile";
        } else {
            $("#create-account").show();
            $(".nav-dropdown").hide();
        }
    });

    // View condos
    $("#view-condo").click(function(){
        if (window.location.pathname === "/") {
            window.scrollBy({
                top: 650,
                left: 0,
                behavior: 'smooth'
            });
        } else {
            window.location.href = "/";       
        }
    });

    // Admin dashboard in dropdown
    $("#admin-dashboard-dropdown").click(function(){
        window.location.href = "/admin";
    });
});

function updateDropdownText(username) { 
    $("#login-button").text(username !== '' ? "View Profile" : 'Login');
    $("#signup-button").text(username !== '' ? 'Edit Profile' : 'Signup');
    $("#logout-button").text('Log Out');
    $("#logout-button").show();
}

function showLogInView(){
    $(".nav-logged-out").hide();
    $(".nav-logged-in").show();
}

function checkWhiteSpace(text){
    return text.indexOf(' ') !== -1;
}

function checkLoginForm(){
    let username = document.forms["login-form"]["username"].value;
    let password = document.forms["login-form"]["password"].value;

    if(username.length < 1 || password.length < 1){
        alert("Login fields must not be empty.");
        return false;
    }

    if(username.length > 20){
        alert("Username must be less than 20 characters.");
        return false;
    }

    if(password.length > 20){
        alert("Password must be less than 20 characters.");
        return false;
    }

    if(checkWhiteSpace(username) || checkWhiteSpace(password)){
        alert("Username and password must not contain white space.");
        return false;
    }
    
    return true;
}

function checkCreateAccountForm(){
    let username = document.forms["create-account-form"]["username"].value;
    let password = document.forms["create-account-form"]["password"].value;
    let confirmPassword = document.forms["create-account-form"]["confirm-password"].value;
    let description = document.forms["create-account-form"]["description"].value;

    let securityQn1 = $("#security-answer-1").val();
    let securityQn2 = $("#security-answer-2").val();

    if(securityQn1.length > 100 || securityQn2.length > 100){
        alert("Answer to Security Questions must be less than 100 characters.");
        return false;
    }

    if(username.length < 1 || password.length < 1 || confirmPassword.length < 1){
        alert("Required fields must not be empty.");
        return false;
    }

    if(username.length > 20){
        alert("Username must be less than 20 characters.");
        return false;
    }

    if(password.length > 20){
        alert("Password must be less than 20 characters.");
        return false;
    }

    if(description.length > 500){
        alert("Bio must be less than 500 characters.");
        return false;
    }

    if(checkWhiteSpace(username) || checkWhiteSpace(password) || checkWhiteSpace(confirmPassword)){
        alert("Username and password must not contain white space.");
        return false;
    }

    // Password complexity
    if((password).length < 9 || !(/[a-z]/.test(password)) ||
       !(/[A-Z]/.test(password)) || !(/[0-9]/.test(password)) ||
       !(/[\W_]/.test(password))){
        alert("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
        return false;
    }

    if(password !== confirmPassword){
        alert("Passwords do not match. Please try again.");
        return false;
    }

    return true;
}