$(document).ready(function(){
    console.log('Reset password page')
    
    $('#security-questions-form').submit(function(event){
        event.preventDefault();

        let answer1 = $('#answer1').val()
        let answer2 = $('#answer2').val()
        let username = $('#reset-username').data('username');

        if(answer1.length > 100 || answer2.length > 100){
            alert('Answers must be less than 100 characters.')
            return
        }

        
        // $.post(
        //     '/resetpassword',
        //     {username: username, answer1: answer1, answer2: answer2},
        //     function(data, status){
        //         if(status === 'success'){
        //             alert(data.message)
        //             window.location.href="/"
        //         } else {
        //             alert(data.message)
        //         }
        //     }
        // );

        $.ajax({
            type: 'POST',
            url: '/resetpassword',
            data: { username: username, answer1: answer1, answer2: answer2 },
            success: function(data){
                alert(data.message)
                window.location.href = "/"
            },
            error: function(xhr){
                // xhr.status is the HTTP status code
                // xhr.responseJSON.message is your message from server
                alert(xhr.responseJSON ? xhr.responseJSON.message : 'An error occurred')
            }
        });
    })
})