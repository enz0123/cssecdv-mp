$(document).ready(function() {
    $('#change-password-popup').hide();



    $('#change-password-button').on('click', function() {
        $('#change-password-popup').show();
    })

    $('#changePasswordForm').on('submit', function(e) {
        e.preventDefault();

        username = $('#username-display').text();
        currentPassword = $('#current-password').val();
        newPassword = $('#new-password').val();
        confirmNewPassword = $('#confirm-new-password').val();

        if (newPassword !== confirmNewPassword) {
            alert('New passwords do not match');
            return;
        }
        
        const formData = {
            username: username,
            currentPassword: currentPassword,
            newPassword: newPassword,
        };

        $.post("/change-password", formData)
            .done(function(data) {
                alert(data.message);

                if (data.statusCode === 200) {
                    $('#change-password-popup').hide();
                }
            })
            .fail(function(xhr) {
                alert(xhr.responseJSON?.message || "Error changing password");
            });

    });
})