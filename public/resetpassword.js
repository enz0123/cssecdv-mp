$(document).ready(function () {
    console.log('Reset password page')

    $('#security-questions-form').submit(function (event) {
        event.preventDefault();

        let answer1 = $('#answer1').val()
        let answer2 = $('#answer2').val()
        let newPassword = $('#new-password').val()
        let username = $('#reset-username').data('username');

        if (answer1.length > 100 || answer2.length > 100) {
            alert('Answers must be less than 100 characters.')
            return
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            alert('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
            return;
        }

        $.ajax({
            type: 'POST',
            url: '/resetpassword',
            data: { username: username, answer1: answer1, answer2: answer2, newPassword: newPassword },
            success: function (data) {
                alert(data.message)
                window.location.href = "/"
            },
            error: function (xhr) {
                // xhr.status is the HTTP status code
                // xhr.responseJSON.message is your message from server
                alert(xhr.responseJSON ? xhr.responseJSON.message : 'An error occurred')
            }
        });
    })
})